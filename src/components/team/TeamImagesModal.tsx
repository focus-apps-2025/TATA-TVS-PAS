import React, { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  type SelectChangeEvent
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  InsertDriveFile as FileIcon,
  PhotoCamera as ImageIcon,
  Upload as UploadIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import api, { type Team } from '../../services/api';

type ImageSection = 'front' | 'group' | 'before' | 'after' | 'completion';

interface TeamImageRecord {
  _id?: string;
  id?: string;
  imageType: 'front' | 'group' | 'before' | 'after';
  category?: string;
  imageUrl: string;
  remarks?: string;
  uploadedAt?: string;
}

interface CategoryOption {
  id: string;
  label: string;
}

interface SectionOption {
  id: ImageSection;
  label: string;
}

interface SelectedFile {
  file: File;
  previewUrl: string;
}

interface TeamImagesModalProps {
  open: boolean;
  team: Team | null;
  canUpload: boolean;
  onClose: () => void;
  onTeamUpdated: (team: Team) => void;
  onMessage: (message: string, severity?: 'success' | 'error' | 'warning' | 'info') => void;
}

const categories: CategoryOption[] = [
  { id: 'spare_location', label: 'Spare Location' },
  { id: 'accessories', label: 'Accessories' },
  { id: 'gowdown', label: 'Gowdown' },
  { id: 'oil', label: 'Oil' },
  { id: 'battery', label: 'Battery' },
  { id: 'tyres', label: 'Tyres' }
];

const sections: SectionOption[] = [
  { id: 'front', label: 'Front image' },
  { id: 'group', label: 'Group image' },
  { id: 'before', label: 'Before images' },
  { id: 'after', label: 'After images' },
  { id: 'completion', label: 'Completion Letter' }
];

const primaryColor = '#004F98';
const successColor = '#10B981';
const mutedTextColor = '#64748B';

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });

const blobToFile = (blob: Blob, fileName: string): File => {
  return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) return error.message || fallback;
  return fallback;
};

const TeamImagesModal: React.FC<TeamImagesModalProps> = ({
  open,
  team,
  canUpload,
  onClose,
  onTeamUpdated,
  onMessage
}) => {
  const [activeSection, setActiveSection] = useState<ImageSection>('front');
  const [selectedCategory, setSelectedCategory] = useState<string>('spare_location');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [remarks, setRemarks] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [cameraOpen, setCameraOpen] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const teamImages = useMemo<TeamImageRecord[]>(() => {
    return Array.isArray(team?.images) ? team.images as TeamImageRecord[] : [];
  }, [team]);

  const selectedExistingImages = useMemo(() => {
    if (activeSection === 'completion') return [];
    return teamImages.filter((image) => {
      if (image.imageType !== activeSection) return false;
      if (activeSection === 'before' || activeSection === 'after') {
        return image.category === selectedCategory;
      }
      return true;
    });
  }, [activeSection, selectedCategory, teamImages]);

  const firstExistingImage = activeSection === 'completion' ? team?.completionLetter : selectedExistingImages[0];
  const hasExistingImage = Boolean(firstExistingImage);
  const existingRemark = firstExistingImage?.remarks || '';
  const isRemarkChanged = remarks !== existingRemark;

  useEffect(() => {
    if (!open) return;
    setActiveSection('front');
    setSelectedCategory('spare_location');
    setSelectedFiles([]);
    setRemarks('');
    setCameraOpen(false);
    setCameraError('');
  }, [open, team?._id, team?.id]);

  useEffect(() => {
    return () => {
      selectedFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [selectedFiles]);

  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!cameraOpen) {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not supported in this browser.');
        return;
      }

      setCameraLoading(true);
      setCameraError('');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' }
          },
          audio: false
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          await cameraVideoRef.current.play();
        }
      } catch (error: unknown) {
        setCameraError(getErrorMessage(error, 'Unable to access the camera.'));
      } finally {
        if (!cancelled) setCameraLoading(false);
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
    };
  }, [cameraOpen]);

  useEffect(() => {
    const firstRemark = activeSection === 'completion'
      ? team?.completionLetter?.remarks || ''
      : selectedExistingImages[0]?.remarks || '';
    setRemarks(firstRemark);
  }, [activeSection, selectedCategory, selectedExistingImages, team?.completionLetter?.remarks]);

  const hasSectionUpload = (sectionId: ImageSection): boolean => {
    if (sectionId === 'completion') {
      return Boolean(team?.completionLetter?.fileUrl);
    }
    return teamImages.some((image) => image.imageType === sectionId);
  };

  const categoryHasImages = (categoryId: string): boolean => {
    if (activeSection !== 'before' && activeSection !== 'after') return false;
    return teamImages.some((image) => image.imageType === activeSection && image.category === categoryId);
  };

  const isMultiImageSection = activeSection === 'before' || activeSection === 'after';
  const accept = activeSection === 'completion' ? 'application/pdf' : 'image/*';
  const activeSectionLabel = sections.find((section) => section.id === activeSection)?.label || 'Image';
  const selectedCategoryLabel = categories.find((category) => category.id === selectedCategory)?.label || 'Category';

  const getUploadLabel = () => {
    if (activeSection === 'completion') return 'Upload Completion Letter';
    return `Upload ${activeSectionLabel}`;
  };

  const getChooseLabel = () => {
    if (activeSection === 'completion') return 'Choose PDF';
    return isMultiImageSection ? 'Choose Images' : 'Choose Image';
  };

  const getUploadedHeading = () => {
    const baseLabel = activeSection === 'before' ? 'Before images' : activeSection === 'after' ? 'After images' : activeSectionLabel;
    return isMultiImageSection ? `Uploaded ${baseLabel} - ${selectedCategoryLabel}` : `Uploaded ${baseLabel}`;
  };

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const allowedFiles = activeSection === 'completion'
      ? files.filter((file) => file.type === 'application/pdf')
      : files.filter((file) => file.type.startsWith('image/'));

    if (!allowedFiles.length) {
      onMessage(activeSection === 'completion' ? 'Please select a PDF file.' : 'Please select image files.', 'warning');
      return;
    }

    setSelectedFiles((previousFiles) => {
      previousFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      const nextFiles = (isMultiImageSection ? allowedFiles : allowedFiles.slice(0, 1)).map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file)
      }));
      return nextFiles;
    });
  };

  const removeSelectedFile = (previewUrl: string) => {
    setSelectedFiles((previousFiles) => {
      const removed = previousFiles.find((item) => item.previewUrl === previewUrl);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return previousFiles.filter((item) => item.previewUrl !== previewUrl);
    });
  };

  const handleUpload = async () => {
    if (!team) return;
    const teamId = team._id || team.id || '';
    if (!teamId) return;

    if (!selectedFiles.length && hasExistingImage && isRemarkChanged) {
      setUploading(true);
      try {
        if (activeSection === 'completion') {
          const result = await api.updateCompletionLetterRemark(teamId, remarks);
          if (!result.success) throw new Error(result.message || 'Failed to update remark.');
          if (result.team) onTeamUpdated(result.team);
          onMessage('Remark updated successfully.', 'success');
        } else {
          const imageId = firstExistingImage._id || firstExistingImage.id;
          if (!imageId) return;
          const result = await api.updateTeamImageRemark(teamId, imageId, remarks);
          if (!result.success) throw new Error(result.message || 'Failed to update remark.');
          if (result.team) onTeamUpdated(result.team);
          onMessage('Remark updated successfully.', 'success');
        }
      } catch (error: unknown) {
        onMessage(getErrorMessage(error, 'Update remark failed.'), 'error');
      } finally {
        setUploading(false);
      }
      return;
    }

    if (!selectedFiles.length) return;

    setUploading(true);
    try {
      let updatedTeam: Team | null = null;

      if (activeSection === 'completion') {
        const file = selectedFiles[0].file;
        const fileData = await fileToDataUrl(file);
        const result = await api.uploadCompletionLetter(teamId, {
          fileData,
          originalName: file.name,
          remarks
        });
        if (!result.success) throw new Error(result.message || 'Completion letter upload failed.');
        updatedTeam = result.team;
      } else {
        for (const selectedFile of selectedFiles) {
          const imageData = await fileToDataUrl(selectedFile.file);
          const result = await api.uploadTeamImage(teamId, {
            imageType: activeSection,
            imageData,
            remarks,
            category: isMultiImageSection ? selectedCategory : undefined
          });
          if (!result.success) throw new Error(result.message || 'Image upload failed.');
          updatedTeam = result.team;
        }
      }

      if (updatedTeam) onTeamUpdated(updatedTeam);
      setSelectedFiles([]);
      onMessage('Upload completed successfully.', 'success');
    } catch (error: unknown) {
      onMessage(getErrorMessage(error, 'Upload failed.'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImageClick = (imageId: string | undefined) => {
    if (!imageId) return;
    setImageToDelete(imageId);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!team || !imageToDelete) return;
    const teamId = team._id || team.id || '';
    if (!teamId) return;

    setDeleting(true);
    try {
      if (imageToDelete === 'completion_letter') {
        const result = await api.deleteCompletionLetter(teamId);
        if (!result.success) throw new Error(result.message || 'Failed to delete completion letter.');
        if (result.team) onTeamUpdated(result.team);
        onMessage('Completion letter deleted successfully.', 'success');
      } else {
        const result = await api.deleteTeamImage(teamId, imageToDelete);
        if (!result.success) throw new Error(result.message || 'Failed to delete image.');
        if (result.team) onTeamUpdated(result.team);
        onMessage('Image deleted successfully.', 'success');
      }
      setDeleteConfirmOpen(false);
      setImageToDelete(null);
    } catch (error: unknown) {
      onMessage(getErrorMessage(error, 'Delete failed.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteRemark = async () => {
    if (!team || !firstExistingImage) return;
    const teamId = team._id || team.id || '';
    if (!teamId) return;

    setDeleting(true);
    try {
      if (activeSection === 'completion') {
        const result = await api.deleteCompletionLetterRemark(teamId);
        if (!result.success) throw new Error(result.message || 'Failed to delete remark.');
        if (result.team) onTeamUpdated(result.team);
        onMessage('Remark deleted successfully.', 'success');
        setRemarks('');
      } else {
        const imageId = firstExistingImage._id || firstExistingImage.id;
        if (!imageId) return;
        const result = await api.deleteTeamImageRemark(teamId, imageId);
        if (!result.success) throw new Error(result.message || 'Failed to delete remark.');
        if (result.team) onTeamUpdated(result.team);
        onMessage('Remark deleted successfully.', 'success');
        setRemarks('');
      }
    } catch (error: unknown) {
      onMessage(getErrorMessage(error, 'Delete remark failed.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename || 'downloaded-image.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      onMessage('Failed to download image.', 'error');
    }
  };

  const handleCategoryChange = (event: SelectChangeEvent<string>) => {
    setSelectedCategory(event.target.value);
    setSelectedFiles([]);
  };

  const closeCamera = () => {
    setCameraOpen(false);
    setCameraError('');
    setCameraLoading(false);
  };

  const handleTakePhoto = () => {
    setCameraOpen(true);
  };

  const handleCapturePhoto = async () => {
    const video = cameraVideoRef.current;
    const canvas = cameraCanvasRef.current;

    if (!video || !canvas || !cameraStreamRef.current) {
      onMessage('Camera is not ready yet. Please try again.', 'warning');
      return;
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (!videoWidth || !videoHeight) {
      onMessage('Camera preview is still loading. Please wait a moment.', 'warning');
      return;
    }

    canvas.width = videoWidth;
    canvas.height = videoHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      onMessage('Unable to capture the photo.', 'error');
      return;
    }

    context.drawImage(video, 0, 0, videoWidth, videoHeight);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    if (!blob) {
      onMessage('Unable to capture the photo.', 'error');
      return;
    }

    const file = blobToFile(blob, `${activeSection}-${Date.now()}.jpg`);
    const previewUrl = URL.createObjectURL(file);

    setSelectedFiles((previousFiles) => {
      previousFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return isMultiImageSection ? [...previousFiles, { file, previewUrl }] : [{ file, previewUrl }];
    });

    closeCamera();
  };

  return (
    <Dialog
      open={open}
      onClose={uploading ? undefined : onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        sx: {
          borderRadius: 1.5,
          minHeight: { xs: 'auto', md: 650 }
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3.5, pt: 2.5, pb: 1 }}>
        <Typography variant="h5" fontWeight={800}>
          Images - {team?.siteName || 'xxx'}
        </Typography>
        <IconButton onClick={onClose} disabled={uploading}>
          <CloseIcon sx={{ fontSize: 28, color: '#666' }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3.5, pt: 3, pb: 2 }}>
        {!canUpload && (
          <Alert severity="info" sx={{ mb: 2 }}>
            You can view uploaded files, but only Admin and Team Lead can upload or edit images.
          </Alert>
        )}

        <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap" sx={{ mb: 2.5 }}>
          {sections.map((section) => {
            const checked = ['front', 'group', 'completion'].includes(section.id) && hasSectionUpload(section.id);
            const active = activeSection === section.id;
            const SectionIcon = section.id === 'completion' ? FileIcon : ImageIcon;
            return (
              <Button
                key={section.id}
                variant={active ? 'contained' : 'outlined'}
                onClick={() => {
                  setActiveSection(section.id);
                  setSelectedFiles([]);
                }}
                startIcon={<SectionIcon sx={{ fontSize: 18 }} />}
                endIcon={checked ? <CheckIcon sx={{ fontSize: 17 }} /> : undefined}
                sx={{
                  borderRadius: 1,
                  px: 1.4,
                  py: 0.8,
                  minHeight: 36,
                  textTransform: 'none',
                  fontWeight: 800,
                  fontStyle: 'italic',
                  bgcolor: checked ? successColor : active ? primaryColor : 'transparent',
                  borderColor: checked ? successColor : primaryColor,
                  color: checked || active ? 'white' : primaryColor,
                  boxShadow: active ? '0 3px 6px rgba(0, 0, 0, 0.22)' : 'none',
                  '&:hover': {
                    bgcolor: checked ? '#059669' : active ? primaryColor : `${primaryColor}10`,
                    borderColor: checked ? '#059669' : primaryColor
                  }
                }}
              >
                {section.label}
              </Button>
            );
          })}
        </Stack>

        {isMultiImageSection && (
          <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={selectedCategory}
              label="Category"
              onChange={handleCategoryChange}
              sx={{
                '& .MuiSelect-select': {
                  py: 1.3,
                  fontSize: 18,
                  fontStyle: 'italic'
                }
              }}
            >
              {categories.map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{category.label}</span>
                    {categoryHasImages(category.id) && <CheckIcon sx={{ color: successColor, fontSize: 18 }} />}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Box
          sx={{
            minHeight: 226,
            border: '1px dashed #cbd5e1',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflowX: selectedFiles.length ? 'auto' : 'hidden',
            p: selectedFiles.length ? 2 : 0,
            mb: 2.5
          }}
        >
          {selectedFiles.length ? (
            <Box sx={{ display: 'flex', gap: 1.5, width: '100%' }}>
              {selectedFiles.map((selectedFile) => (
                <Paper key={selectedFile.previewUrl} variant="outlined" sx={{ p: 1, minWidth: 170, position: 'relative' }}>
                  <Box sx={{ position: 'absolute', right: 5, top: 5, display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 100 }}>
                    {activeSection !== 'completion' && (
                      <IconButton
                        size="small"
                        onClick={() => setPreviewImage(selectedFile.previewUrl)}
                        sx={{ bgcolor: 'rgba(255,255,255,0.92)' }}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => removeSelectedFile(selectedFile.previewUrl)}
                      sx={{ bgcolor: 'rgba(255,255,255,0.92)' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  {activeSection === 'completion' ? (
                    <Box sx={{ width: 150, height: 130, display: 'grid', placeItems: 'center' }}>
                      <FileIcon sx={{ fontSize: 52, color: primaryColor }} />
                    </Box>
                  ) : (
                    <Box
                      component="img"
                      src={selectedFile.previewUrl}
                      alt={selectedFile.file.name}
                      sx={{ width: 150, height: 130, objectFit: 'cover', borderRadius: 1, display: 'block', cursor: 'pointer' }}
                      onClick={() => setPreviewImage(selectedFile.previewUrl)}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 150, mt: 0.5 }}>
                    {selectedFile.file.name}
                  </Typography>
                </Paper>
              ))}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', color: mutedTextColor }}>
              <ImageIcon sx={{ fontSize: 30, display: 'block', mx: 'auto', mb: 1 }} />
              <Typography variant="subtitle1" sx={{ fontStyle: 'italic', fontWeight: 500 }}>
                No image selected yet
              </Typography>
            </Box>
          )}
        </Box>

        <>
          {canUpload && (
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept={accept}
              multiple={isMultiImageSection}
              onChange={handleFilesSelected}
            />
          )}

          {canUpload && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 2.5 }}>
              {activeSection !== 'completion' && (
                <Button
                  variant="contained"
                  startIcon={<CameraIcon />}
                  onClick={handleTakePhoto}
                  sx={{
                    bgcolor: primaryColor,
                    textTransform: 'none',
                    fontWeight: 800,
                    fontStyle: 'italic',
                    boxShadow: '0 3px 6px rgba(0, 0, 0, 0.22)',
                    '&:hover': { bgcolor: '#0066CC' }
                  }}
                >
                  {selectedFiles.length ? 'Retake Photo' : 'Take Photo'}
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={activeSection === 'completion' ? <FileIcon /> : undefined}
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  borderColor: primaryColor,
                  color: primaryColor,
                  textTransform: 'none',
                  fontWeight: 800,
                  fontStyle: 'italic',
                  px: 2.4,
                  '&:hover': { bgcolor: `${primaryColor}10`, borderColor: primaryColor }
                }}
              >
                {getChooseLabel()}
              </Button>
            </Stack>
          )}
        </>

        <Dialog
          open={cameraOpen}
          onClose={cameraLoading ? undefined : closeCamera}
          fullWidth
          maxWidth="sm"
          PaperProps={{
            sx: {
              borderRadius: 1.5
            }
          }}
        >
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, pt: 2.5, pb: 1 }}>
            <Typography variant="h6" fontWeight={800}>
              Take Photo
            </Typography>
            <IconButton onClick={closeCamera} disabled={cameraLoading}>
              <CloseIcon sx={{ fontSize: 24, color: '#666' }} />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pb: 2 }}>
            {cameraError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {cameraError}
              </Alert>
            ) : null}
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                aspectRatio: '4 / 3',
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: '#0f172a',
                display: 'grid',
                placeItems: 'center'
              }}
            >
              {cameraLoading && (
                <CircularProgress sx={{ color: 'white', position: 'absolute' }} />
              )}
              <Box
                component="video"
                ref={cameraVideoRef}
                autoPlay
                playsInline
                muted
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: cameraError ? 'none' : 'block'
                }}
              />
              <canvas ref={cameraCanvasRef} hidden />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button
              onClick={closeCamera}
              disabled={cameraLoading}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<CameraIcon />}
              onClick={() => void handleCapturePhoto()}
              disabled={cameraLoading || Boolean(cameraError)}
              sx={{
                bgcolor: primaryColor,
                textTransform: 'none',
                fontWeight: 800,
                fontStyle: 'italic',
                '&:hover': { bgcolor: '#0066CC' }
              }}
            >
              Capture
            </Button>
          </DialogActions>
        </Dialog>

        <TextField
          placeholder="Remarks"
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          multiline
          minRows={3}
          fullWidth
          disabled={!canUpload || uploading}
          sx={{
            mb: 2.5,
            '& .MuiOutlinedInput-root': {
              borderRadius: 0.5,
              alignItems: 'flex-start',
              px: 1.5,
              py: 1.2
            }
          }}
          InputProps={{
            endAdornment: canUpload && (activeSection === 'completion' ? team?.completionLetter?.remarks : selectedExistingImages[0]?.remarks) && (
              <InputAdornment position="end" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                <IconButton onClick={handleDeleteRemark} disabled={deleting} color="error" title="Delete Remark">
                  {deleting ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                </IconButton>
              </InputAdornment>
            )
          }}
        />

        {activeSection === 'completion' ? (
          <Box sx={{ minHeight: 54 }}>
            <Typography variant="subtitle1" fontWeight={800}>Uploaded Completion Letter</Typography>
            {team?.completionLetter?.fileUrl ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Button href={team.completionLetter.fileUrl} target="_blank" rel="noreferrer" startIcon={<FileIcon />} sx={{ px: 0 }}>
                  {team.completionLetter.originalName || 'Completion letter.pdf'}
                </Button>
                {canUpload && (
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteImageClick('completion_letter')}
                    disabled={deleting && imageToDelete === 'completion_letter'}
                    color="error"
                  >
                    {deleting && imageToDelete === 'completion_letter' ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                  </IconButton>
                )}
              </Box>
            ) : (
              <Typography variant="subtitle1" sx={{ color: '#666', fontStyle: 'italic' }}>
                No completion letter uploaded yet.
              </Typography>
            )}
          </Box>
        ) : (
          <Box sx={{ minHeight: 84 }}>
            <Typography variant="subtitle1" fontWeight={800}>{getUploadedHeading()}</Typography>
            {selectedExistingImages.length ? (
              <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, pt: 1 }}>
                {selectedExistingImages.map((image, index) => {
                  const imageName = `${activeSection}_${index + 1}.jpg`;
                  return (
                    <Paper key={`${image.imageUrl}-${index}`} variant="outlined" sx={{ p: 1, minWidth: 150, position: 'relative' }}>
                      <Box sx={{ position: 'absolute', right: 5, top: 5, display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 100 }}>
                        <IconButton
                          size="small"
                          onClick={() => setPreviewImage(image.imageUrl)}
                          sx={{ bgcolor: 'rgba(255,255,255,0.92)' }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDownloadImage(image.imageUrl, imageName)}
                          sx={{ bgcolor: 'rgba(255,255,255,0.92)' }}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                        {canUpload && (image._id || image.id) && (
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteImageClick(image._id || image.id)}
                            disabled={deleting && imageToDelete === (image._id || image.id)}
                            sx={{ bgcolor: 'rgba(255,255,255,0.92)' }}
                          >
                            {deleting && imageToDelete === (image._id || image.id) ? (
                              <CircularProgress size={16} />
                            ) : (
                              <DeleteIcon fontSize="small" color="error" />
                            )}
                          </IconButton>
                        )}
                      </Box>
                      <Box
                        component="img"
                        src={image.imageUrl}
                        alt={`${activeSection} ${index + 1}`}
                        sx={{ width: 132, height: 96, objectFit: 'cover', borderRadius: 1, display: 'block', cursor: 'pointer' }}
                        onClick={() => setPreviewImage(image.imageUrl)}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {activeSection === 'before' ? 'Before' : activeSection === 'after' ? 'After' : activeSectionLabel} Image {index + 1}
                      </Typography>
                    </Paper>
                  );
                })}
              </Box>
            ) : (
              <Typography variant="subtitle1" sx={{ color: '#666', fontStyle: 'italic' }}>
                {isMultiImageSection
                  ? 'No images uploaded in this category yet.'
                  : 'No image uploaded yet.'}
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, pt: 0 }}>
        {canUpload && (
          <Button
            variant="contained"
            startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
            disabled={(!selectedFiles.length && !(hasExistingImage && isRemarkChanged)) || uploading}
            onClick={handleUpload}
            sx={{
              ml: 'auto',
              bgcolor: primaryColor,
              textTransform: 'none',
              fontWeight: 800,
              fontStyle: 'italic',
              borderRadius: 1,
              px: 2.2,
              py: 1,
              '&:hover': { bgcolor: '#0066CC' },
              '&.Mui-disabled': {
                bgcolor: '#e0e0e0',
                color: '#9e9e9e'
              }
            }}
          >
            {(!selectedFiles.length && hasExistingImage && isRemarkChanged) ? 'Save Remark' : (uploading ? 'Uploading...' : getUploadLabel())}
          </Button>
        )}
      </DialogActions>

      <Dialog open={deleteConfirmOpen} onClose={deleting ? undefined : () => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            {imageToDelete === 'completion_letter' 
              ? 'Are you sure you want to delete this completion letter?' 
              : 'Are you sure you want to delete this image?'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={deleting} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(previewImage)} onClose={() => setPreviewImage(null)} maxWidth="lg">
        <DialogContent sx={{ p: 0, position: 'relative', bgcolor: '#000', display: 'flex', justifyContent: 'center' }}>
          <IconButton
            onClick={() => setPreviewImage(null)}
            sx={{ position: 'absolute', right: 8, top: 8, bgcolor: 'rgba(0,0,0,0.5)', color: 'white', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
          >
            <CloseIcon />
          </IconButton>
          <img src={previewImage || ''} alt="Preview" style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', display: 'block' }} />
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default TeamImagesModal;
