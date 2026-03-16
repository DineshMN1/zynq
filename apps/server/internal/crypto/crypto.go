package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"io"
)

const (
	ivLength      = 12
	dekLength     = 32
	authTagLength = 16
	// ChunkSize is the plaintext bytes per GCM chunk for streaming encryption.
	ChunkSize = 64 * 1024 * 1024 // 64 MiB
)

type Crypto struct {
	masterKey []byte
}

func New(masterKeyBase64 string) (*Crypto, error) {
	key, err := base64.StdEncoding.DecodeString(masterKeyBase64)
	if err != nil {
		return nil, err
	}
	if len(key) != 32 {
		return nil, errors.New("FILE_ENCRYPTION_MASTER_KEY must be exactly 32 bytes when base64-decoded")
	}
	return &Crypto{masterKey: key}, nil
}

func (c *Crypto) GenerateDEK() ([]byte, error) {
	dek := make([]byte, dekLength)
	_, err := rand.Read(dek)
	return dek, err
}

func (c *Crypto) GenerateIV() ([]byte, error) {
	iv := make([]byte, ivLength)
	_, err := rand.Read(iv)
	return iv, err
}

// EncryptDEK encrypts the DEK with the master key.
func (c *Crypto) EncryptDEK(dek []byte) (dekIv []byte, encryptedDEK []byte, err error) {
	dekIv, err = c.GenerateIV()
	if err != nil {
		return
	}
	block, err := aes.NewCipher(c.masterKey)
	if err != nil {
		return
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return
	}
	encryptedDEK = gcm.Seal(nil, dekIv, dek, nil)
	return
}

// DecryptDEK decrypts the DEK.
func (c *Crypto) DecryptDEK(encryptedDEKWithTag, dekIv []byte) ([]byte, error) {
	block, err := aes.NewCipher(c.masterKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, dekIv, encryptedDEKWithTag, nil)
}

// CreateEncryptionKeys generates all keys needed for a new file.
func (c *Crypto) CreateEncryptionKeys() (dek, iv, storedEncryptedDEK []byte, algorithm string, err error) {
	dek, err = c.GenerateDEK()
	if err != nil {
		return
	}
	iv, err = c.GenerateIV()
	if err != nil {
		return
	}
	dekIv, encryptedDEK, err := c.EncryptDEK(dek)
	if err != nil {
		return
	}
	storedEncryptedDEK = append(dekIv, encryptedDEK...)
	algorithm = "AES-256-GCM-STREAM"
	return
}

// DecryptFileKey extracts the DEK from the stored encrypted_dek field.
func (c *Crypto) DecryptFileKey(storedEncryptedDEK []byte) ([]byte, error) {
	if len(storedEncryptedDEK) < ivLength {
		return nil, errors.New("invalid encrypted_dek length")
	}
	dekIv := storedEncryptedDEK[:ivLength]
	actualEncrypted := storedEncryptedDEK[ivLength:]
	return c.DecryptDEK(actualEncrypted, dekIv)
}

// EncryptBuffer encrypts plaintext with AES-256-GCM (legacy / small-file path).
func EncryptBuffer(plaintext, dek, iv []byte) ([]byte, error) {
	block, err := aes.NewCipher(dek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return gcm.Seal(nil, iv, plaintext, nil), nil
}

// DecryptBuffer decrypts AES-256-GCM ciphertext (legacy / small-file path).
func DecryptBuffer(ciphertextWithTag, dek, iv []byte) ([]byte, error) {
	block, err := aes.NewCipher(dek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, iv, ciphertextWithTag, nil)
}

// chunkNonce derives a per-chunk nonce by XOR-ing the last 4 bytes of baseIV
// with the big-endian uint32 chunk index.  The result is a fresh 12-byte nonce
// for each chunk so nonces are never reused under the same DEK.
func chunkNonce(baseIV []byte, index uint32) []byte {
	nonce := make([]byte, ivLength)
	copy(nonce, baseIV)
	var idxBuf [4]byte
	binary.BigEndian.PutUint32(idxBuf[:], index)
	for i := 0; i < 4; i++ {
		nonce[ivLength-4+i] ^= idxBuf[i]
	}
	return nonce
}

// EncryptStream reads plaintext from r and writes the AES-256-GCM-STREAM
// chunked ciphertext to w.
//
// On-disk format for each chunk:
//
//	[4-byte big-endian plain chunk size] [12-byte nonce] [ciphertext + 16-byte GCM tag]
//
// Returns the total plaintext bytes consumed.
func EncryptStream(r io.Reader, w io.Writer, dek, baseIV []byte) (int64, error) {
	block, err := aes.NewCipher(dek)
	if err != nil {
		return 0, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return 0, err
	}

	buf := make([]byte, ChunkSize)
	var total int64
	var idx uint32

	for {
		n, readErr := io.ReadFull(r, buf)
		if n > 0 {
			total += int64(n)
			nonce := chunkNonce(baseIV, idx)

			// Write 4-byte plain size header
			var hdr [4]byte
			binary.BigEndian.PutUint32(hdr[:], uint32(n))
			if _, err := w.Write(hdr[:]); err != nil {
				return total, err
			}
			// Write nonce
			if _, err := w.Write(nonce); err != nil {
				return total, err
			}
			// Write sealed ciphertext + tag
			sealed := gcm.Seal(nil, nonce, buf[:n], nil)
			if _, err := w.Write(sealed); err != nil {
				return total, err
			}
			idx++
		}
		if readErr == io.EOF || readErr == io.ErrUnexpectedEOF {
			break
		}
		if readErr != nil {
			return total, readErr
		}
	}
	return total, nil
}

// DecryptStream reads AES-256-GCM-STREAM chunked ciphertext from r and writes
// decrypted plaintext to w.
func DecryptStream(r io.Reader, w io.Writer, dek, baseIV []byte) error {
	block, err := aes.NewCipher(dek)
	if err != nil {
		return err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}

	var idx uint32
	var hdr [4]byte

	for {
		_, err := io.ReadFull(r, hdr[:])
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		plainSize := binary.BigEndian.Uint32(hdr[:])

		nonce := make([]byte, ivLength)
		if _, err := io.ReadFull(r, nonce); err != nil {
			return err
		}

		sealed := make([]byte, int(plainSize)+authTagLength)
		if _, err := io.ReadFull(r, sealed); err != nil {
			return err
		}

		expectedNonce := chunkNonce(baseIV, idx)
		plain, err := gcm.Open(nil, expectedNonce, sealed, nil)
		if err != nil {
			return err
		}
		if _, err := w.Write(plain); err != nil {
			return err
		}
		idx++
	}
	return nil
}
