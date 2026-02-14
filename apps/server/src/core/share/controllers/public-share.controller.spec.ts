import { Test, TestingModule } from '@nestjs/testing';
import { PublicShareController } from './public-share.controller';
import { FileService } from '../../file/file.service';

describe('PublicShareController', () => {
  let controller: PublicShareController;
  let fileService: jest.Mocked<FileService>;

  const mockFile = {
    id: 'file-123',
    name: 'shared-doc.pdf',
    mime_type: 'application/pdf',
    size: 2048,
    is_folder: false,
    owner_id: 'user-123',
  };

  const mockResponse = {
    set: jest.fn(),
    send: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicShareController],
      providers: [
        {
          provide: FileService,
          useValue: {
            getPublicShare: jest.fn(),
            downloadPublicFile: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PublicShareController>(PublicShareController);
    fileService = module.get(FileService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPublicShare', () => {
    it('should delegate to fileService.getPublicShare', async () => {
      const shareData = { file: mockFile, share: { token: 'abc123' } };
      fileService.getPublicShare.mockResolvedValue(shareData as any);

      const result = await controller.getPublicShare('abc123');

      expect(fileService.getPublicShare).toHaveBeenCalledWith('abc123');
      expect(result).toEqual(shareData);
    });
  });

  describe('downloadPublicFile', () => {
    it('should set headers and send data', async () => {
      const fileData = Buffer.from('file content');
      fileService.downloadPublicFile.mockResolvedValue({
        data: fileData,
        file: mockFile as any,
      });

      await controller.downloadPublicFile('abc123', mockResponse);

      expect(fileService.downloadPublicFile).toHaveBeenCalledWith('abc123');
      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Length': fileData.length,
        }),
      );
      expect(mockResponse.send).toHaveBeenCalledWith(fileData);
    });

    it('should use fallback Content-Type when mime_type is null', async () => {
      const fileData = Buffer.from('binary data');
      const fileWithNoMime = { ...mockFile, mime_type: null };
      fileService.downloadPublicFile.mockResolvedValue({
        data: fileData,
        file: fileWithNoMime as any,
      });

      await controller.downloadPublicFile('token-456', mockResponse);

      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/octet-stream',
        }),
      );
    });
  });
});
