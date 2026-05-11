import React, { useState, useCallback } from 'react';
import { Camera, Upload, X, Eye, Trash2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Photo {
  id: string;
  url: string;
  file?: File;
  description: string;
  uploadedAt: string;
  uploadedBy?: string;
  isUploading?: boolean;
}

interface PhotoUploadProps {
  photos: Photo[];
  onPhotosChange: (photos: Photo[]) => void;
  maxPhotos?: number;
  acceptedTypes?: string[];
  maxFileSize?: number; // in MB
  disabled?: boolean;
  showCamera?: boolean;
  label?: string;
  description?: string;
}

export function PhotoUpload({
  photos = [],
  onPhotosChange,
  maxPhotos = 5,
  acceptedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  maxFileSize = 5,
  disabled = false,
  showCamera = true,
  label = 'Upload Photos',
  description = 'Add photos for documentation'
}: PhotoUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];

    // Validate files
    fileArray.forEach(file => {
      if (!acceptedTypes.includes(file.type)) {
        return;
      }
      
      if (file.size > maxFileSize * 1024 * 1024) {
        return;
      }
      
      validFiles.push(file);
    });

    // Check total photo count
    if (photos.length + validFiles.length > maxPhotos) {
      validFiles.splice(maxPhotos - photos.length);
    }

    // Create photo objects
    const newPhotos: Photo[] = validFiles.map(file => ({
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: URL.createObjectURL(file),
      file,
      description: '',
      uploadedAt: new Date().toISOString(),
      isUploading: false
    }));

    onPhotosChange([...photos, ...newPhotos]);
  }, [photos, onPhotosChange, maxPhotos, acceptedTypes, maxFileSize]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    if (files?.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles, disabled]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setDragActive(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length > 0) {
      handleFiles(files);
    }
    // Reset input value to allow uploading same file again
    e.target.value = '';
  }, [handleFiles]);

  const removePhoto = useCallback((photoId: string) => {
    const updatedPhotos = photos.filter(photo => photo.id !== photoId);
    
    // Clean up object URLs to prevent memory leaks
    const photoToRemove = photos.find(p => p.id === photoId);
    if (photoToRemove?.url.startsWith('blob:')) {
      URL.revokeObjectURL(photoToRemove.url);
    }
    
    onPhotosChange(updatedPhotos);
  }, [photos, onPhotosChange]);

  const updatePhotoDescription = useCallback((photoId: string, description: string) => {
    const updatedPhotos = photos.map(photo =>
      photo.id === photoId ? { ...photo, description } : photo
    );
    onPhotosChange(updatedPhotos);
  }, [photos, onPhotosChange]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'environment' // Use rear camera if available
        } 
      });
      setCameraStream(stream);
      setShowCameraModal(true);
    } catch (error) {
      alert('Could not access camera. Please check permissions.');
    }
  };

  const capturePhoto = () => {
    if (!cameraStream) return;

    const video = document.getElementById('cameraVideo') as HTMLVideoElement;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        handleFiles([file]);
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCameraModal(false);
  };

  const canUploadMore = photos.length < maxPhotos;

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      {canUploadMore && !disabled && (
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
          
          {/* Drag & Drop Area */}
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${dragActive 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
              }
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">
              Drag and drop photos here, or click to select files
            </p>
            
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                type="button"
                variant="secondary"
                onClick={() => document.getElementById('fileInput')?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose Files
              </Button>
              
              {showCamera && navigator.mediaDevices && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={startCamera}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo
                </Button>
              )}
            </div>
            
            <input
              id="fileInput"
              type="file"
              multiple
              accept={acceptedTypes.join(',')}
              onChange={handleFileInput}
              className="hidden"
            />
            
            <p className="text-xs text-gray-500 mt-4">
              Maximum {maxPhotos} photos, up to {maxFileSize}MB each
              <br />
              Supported: {acceptedTypes.map(type => type.split('/')[1]).join(', ')}
            </p>
          </div>
        </Card>
      )}

      {/* Photo Grid */}
      {photos.length > 0 && (
        <Card className="p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">
            Uploaded Photos ({photos.length}/{maxPhotos})
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map(photo => (
              <div key={photo.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={photo.url}
                    alt={photo.description || 'Uploaded photo'}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Overlay with actions */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setPreviewPhoto(photo)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {!disabled && (
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={() => removePhoto(photo.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Description Input */}
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Add description..."
                    value={photo.description}
                    onChange={(e) => updatePhotoDescription(photo.id, e.target.value)}
                    disabled={disabled}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </div>
                
                {photo.isUploading && (
                  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Camera Modal */}
      {showCamera && cameraStream && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Take Photo</h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={stopCamera}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <video
                id="cameraVideo"
                autoPlay
                playsInline
                muted
                ref={(video) => {
                  if (video && cameraStream) {
                    video.srcObject = cameraStream;
                  }
                }}
                className="w-full aspect-square object-cover rounded-lg bg-gray-900"
              />
              
              <div className="flex justify-center">
                <Button onClick={capturePhoto}>
                  <Camera className="w-4 h-4 mr-2" />
                  Capture
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Photo Preview</h3>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setPreviewPhoto(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.description || 'Photo preview'}
                className="w-full max-h-96 object-contain rounded-lg"
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={previewPhoto.description}
                  onChange={(e) => updatePhotoDescription(previewPhoto.id, e.target.value)}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                  placeholder="Enter photo description..."
                />
              </div>
              
              <div className="text-sm text-gray-500">
                Uploaded: {new Date(previewPhoto.uploadedAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PhotoUpload;