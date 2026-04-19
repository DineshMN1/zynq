package crypto

import (
	"bytes"
	"encoding/base64"
	"strings"
	"testing"
)

// validMasterKey returns a base64-encoded 32-byte key for tests.
func validMasterKey() string {
	return base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{0x42}, 32))
}

func TestNew_ValidKey(t *testing.T) {
	_, err := New(validMasterKey())
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestNew_InvalidBase64(t *testing.T) {
	_, err := New("not-valid-base64!!!")
	if err == nil {
		t.Fatal("expected error for invalid base64")
	}
}

func TestNew_WrongKeyLength(t *testing.T) {
	short := base64.StdEncoding.EncodeToString([]byte("tooshort"))
	_, err := New(short)
	if err == nil {
		t.Fatal("expected error for key that is not 32 bytes")
	}
}

func TestDEKRoundTrip(t *testing.T) {
	c, _ := New(validMasterKey())

	dek, err := c.GenerateDEK()
	if err != nil {
		t.Fatalf("GenerateDEK: %v", err)
	}
	if len(dek) != dekLength {
		t.Fatalf("expected DEK length %d, got %d", dekLength, len(dek))
	}

	iv, encDEK, err := c.EncryptDEK(dek)
	if err != nil {
		t.Fatalf("EncryptDEK: %v", err)
	}

	decDEK, err := c.DecryptDEK(encDEK, iv)
	if err != nil {
		t.Fatalf("DecryptDEK: %v", err)
	}
	if !bytes.Equal(dek, decDEK) {
		t.Fatal("decrypted DEK does not match original")
	}
}

func TestCreateEncryptionKeys(t *testing.T) {
	c, _ := New(validMasterKey())
	dek, iv, storedDEK, algo, err := c.CreateEncryptionKeys()
	if err != nil {
		t.Fatalf("CreateEncryptionKeys: %v", err)
	}
	if len(dek) != dekLength {
		t.Errorf("wrong DEK length: %d", len(dek))
	}
	if len(iv) != ivLength {
		t.Errorf("wrong IV length: %d", len(iv))
	}
	if len(storedDEK) == 0 {
		t.Error("storedEncryptedDEK is empty")
	}
	if !strings.Contains(algo, "AES-256-GCM") {
		t.Errorf("unexpected algorithm: %s", algo)
	}

	// Verify we can recover the DEK from the stored blob.
	recovered, err := c.DecryptFileKey(storedDEK)
	if err != nil {
		t.Fatalf("DecryptFileKey: %v", err)
	}
	if !bytes.Equal(dek, recovered) {
		t.Fatal("recovered DEK does not match original")
	}
}

func TestStreamEncryptDecryptRoundTrip(t *testing.T) {
	c, _ := New(validMasterKey())
	dek, _ := c.GenerateDEK()
	iv, _ := c.GenerateIV()

	plaintext := []byte("ZynqCloud self-hosted file storage — end-to-end encryption test.")

	var cipherBuf bytes.Buffer
	n, err := EncryptStream(bytes.NewReader(plaintext), &cipherBuf, dek, iv)
	if err != nil {
		t.Fatalf("EncryptStream: %v", err)
	}
	if n != int64(len(plaintext)) {
		t.Errorf("EncryptStream returned %d bytes, want %d", n, len(plaintext))
	}

	var plainBuf bytes.Buffer
	if err := DecryptStream(&cipherBuf, &plainBuf, dek, iv); err != nil {
		t.Fatalf("DecryptStream: %v", err)
	}
	if !bytes.Equal(plainBuf.Bytes(), plaintext) {
		t.Fatalf("decrypted content mismatch:\ngot  %q\nwant %q", plainBuf.Bytes(), plaintext)
	}
}

func TestStreamEncryptLargeFile(t *testing.T) {
	c, _ := New(validMasterKey())
	dek, _ := c.GenerateDEK()
	iv, _ := c.GenerateIV()

	// 3 chunks of data (> 2 × ChunkSize) to exercise multi-chunk path.
	size := ChunkSize*2 + 1024
	plaintext := bytes.Repeat([]byte{0xAB}, size)

	var cipherBuf bytes.Buffer
	if _, err := EncryptStream(bytes.NewReader(plaintext), &cipherBuf, dek, iv); err != nil {
		t.Fatalf("EncryptStream large: %v", err)
	}

	var plainBuf bytes.Buffer
	if err := DecryptStream(&cipherBuf, &plainBuf, dek, iv); err != nil {
		t.Fatalf("DecryptStream large: %v", err)
	}
	if !bytes.Equal(plainBuf.Bytes(), plaintext) {
		t.Fatal("large-file round-trip produced wrong plaintext")
	}
}

func TestDecryptWithWrongKey(t *testing.T) {
	c1, _ := New(validMasterKey())
	key2 := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{0xFF}, 32))
	c2, _ := New(key2)

	dek, _ := c1.GenerateDEK()
	iv, encDEK, _ := c1.EncryptDEK(dek)

	// Decrypting with a different master key must fail.
	_, err := c2.DecryptDEK(encDEK, iv)
	if err == nil {
		t.Fatal("expected decryption failure with wrong master key")
	}
}

func TestDecryptStreamTamperedCiphertext(t *testing.T) {
	c, _ := New(validMasterKey())
	dek, _ := c.GenerateDEK()
	iv, _ := c.GenerateIV()

	var cipherBuf bytes.Buffer
	EncryptStream(bytes.NewReader([]byte("hello tamper test")), &cipherBuf, dek, iv) //nolint:errcheck

	// Flip a byte in the ciphertext to simulate tampering.
	data := cipherBuf.Bytes()
	data[len(data)-1] ^= 0xFF

	var out bytes.Buffer
	err := DecryptStream(bytes.NewReader(data), &out, dek, iv)
	if err == nil {
		t.Fatal("expected authentication failure on tampered ciphertext")
	}
}
