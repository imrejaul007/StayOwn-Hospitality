import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Button,
  Grid,
  Typography,
  Divider,
  IconButton,
  Card,
  CardContent,
  CardHeader,
  Alert
} from '@mui/material';
import { Add, Delete, Save, Cancel } from '@mui/icons-material';

interface AccountAttribute {
  _id?: string;
  name: string;
  label: string;
  type: string;
  category: string;
  description?: string;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    options?: Array<{
      value: string;
      label: string;
      isDefault: boolean;
    }>;
  };
  defaultValue?: string;
}

interface AccountAttributeFormProps {
  attribute?: AccountAttribute | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

const AccountAttributeForm: React.FC<AccountAttributeFormProps> = ({
  attribute,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState<AccountAttribute>({
    name: '',
    label: '',
    type: 'text',
    category: 'personal',
    description: '',
    isRequired: false,
    isActive: true,
    displayOrder: 0,
    validation: {},
    defaultValue: ''
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [validationOptions, setValidationOptions] = useState<Array<{
    value: string;
    label: string;
    isDefault: boolean;
  }>>([]);

  const fieldTypes = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'select', label: 'Select' },
    { value: 'multiselect', label: 'Multi-Select' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'url', label: 'URL' },
    { value: 'file', label: 'File' }
  ];

  const categories = [
    { value: 'personal', label: 'Personal' },
    { value: 'business', label: 'Business' },
    { value: 'financial', label: 'Financial' },
    { value: 'contact', label: 'Contact' },
    { value: 'preferences', label: 'Preferences' },
    { value: 'security', label: 'Security' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    if (attribute) {
      setFormData(attribute);
      if (attribute.validation?.options) {
        setValidationOptions(attribute.validation.options);
      }
    }
  }, [attribute]);

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleValidationChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      validation: {
        ...prev.validation,
        [field]: value
      }
    }));
  };

  const addValidationOption = () => {
    setValidationOptions(prev => [
      ...prev,
      { value: '', label: '', isDefault: false }
    ]);
  };

  const removeValidationOption = (index: number) => {
    setValidationOptions(prev => prev.filter((_, i) => i !== index));
  };

  const updateValidationOption = (index: number, field: string, value: unknown) => {
    setValidationOptions(prev => prev.map((option, i) => 
      i === index ? { ...option, [field]: value } : option
    ));
  };

  const setDefaultOption = (index: number) => {
    setValidationOptions(prev => prev.map((option, i) => ({
      ...option,
      isDefault: i === index
    })));
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(formData.name)) {
      newErrors.name = 'Name must start with a letter or underscore and contain only letters, numbers, and underscores';
    }

    if (!formData.label.trim()) {
      newErrors.label = 'Label is required';
    }

    if ((formData.type === 'select' || formData.type === 'multiselect') && validationOptions.length === 0) {
      newErrors.options = 'At least one option is required for select fields';
    }

    if (formData.validation?.minLength && formData.validation?.maxLength) {
      if (formData.validation.minLength > formData.validation.maxLength) {
        newErrors.maxLength = 'Maximum length must be greater than minimum length';
      }
    }

    if (formData.validation?.min !== undefined && formData.validation?.max !== undefined) {
      if (formData.validation.min > formData.validation.max) {
        newErrors.max = 'Maximum value must be greater than minimum value';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const submitData = {
      ...formData,
      validation: {
        ...formData.validation,
        options: (formData.type === 'select' || formData.type === 'multiselect') ? validationOptions : undefined
      }
    };

    onSubmit(submitData);
  };

  const isSelectType = formData.type === 'select' || formData.type === 'multiselect';

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name || 'Internal field name (letters, numbers, underscores only)'}
            disabled={!!attribute}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Label"
            value={formData.label}
            onChange={(e) => handleInputChange('label', e.target.value)}
            error={!!errors.label}
            helperText={errors.label || 'Display label for the field'}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={formData.type}
              label="Type"
              onChange={(e) => handleInputChange('type', e.target.value)}
            >
              {fieldTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={formData.category}
              label="Category"
              onChange={(e) => handleInputChange('category', e.target.value)}
            >
              {categories.map((category) => (
                <MenuItem key={category.value} value={category.value}>
                  {category.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            multiline
            rows={2}
            helperText="Optional description for the field"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Display Order"
            type="number"
            value={formData.displayOrder}
            onChange={(e) => handleInputChange('displayOrder', parseInt(e.target.value) || 0)}
            helperText="Order in which fields appear"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Default Value"
            value={formData.defaultValue}
            onChange={(e) => handleInputChange('defaultValue', e.target.value)}
            helperText="Default value for the field"
          />
        </Grid>

        {/* Settings */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Settings
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.isRequired}
                onChange={(e) => handleInputChange('isRequired', e.target.checked)}
              />
            }
            label="Required Field"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
              />
            }
            label="Active"
          />
        </Grid>

        {/* Validation Rules */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Validation Rules
          </Typography>
        </Grid>

        {formData.type === 'text' || formData.type === 'textarea' || formData.type === 'email' || formData.type === 'phone' || formData.type === 'url' ? (
          <>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Minimum Length"
                type="number"
                value={formData.validation?.minLength || ''}
                onChange={(e) => handleValidationChange('minLength', parseInt(e.target.value) || undefined)}
                helperText="Minimum number of characters"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Maximum Length"
                type="number"
                value={formData.validation?.maxLength || ''}
                onChange={(e) => handleValidationChange('maxLength', parseInt(e.target.value) || undefined)}
                error={!!errors.maxLength}
                helperText={errors.maxLength || "Maximum number of characters"}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Pattern (Regex)"
                value={formData.validation?.pattern || ''}
                onChange={(e) => handleValidationChange('pattern', e.target.value)}
                helperText="Regular expression pattern for validation"
              />
            </Grid>
          </>
        ) : null}

        {formData.type === 'number' ? (
          <>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Minimum Value"
                type="number"
                value={formData.validation?.min || ''}
                onChange={(e) => handleValidationChange('min', parseFloat(e.target.value) || undefined)}
                helperText="Minimum allowed value"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Maximum Value"
                type="number"
                value={formData.validation?.max || ''}
                onChange={(e) => handleValidationChange('max', parseFloat(e.target.value) || undefined)}
                error={!!errors.max}
                helperText={errors.max || "Maximum allowed value"}
              />
            </Grid>
          </>
        ) : null}

        {/* Select Options */}
        {isSelectType && (
          <Grid item xs={12}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle1">
                Options
              </Typography>
              <Button
                startIcon={<Add />}
                onClick={addValidationOption}
                size="small"
              >
                Add Option
              </Button>
            </Box>

            {validationOptions.map((option, index) => (
              <Card key={`validationOptions-${index}-${option}`} sx={{ mb: 2 }}>
                <CardContent>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Value"
                        value={option.value}
                        onChange={(e) => updateValidationOption(index, 'value', e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Label"
                        value={option.label}
                        onChange={(e) => updateValidationOption(index, 'label', e.target.value)}
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={option.isDefault}
                            onChange={() => setDefaultOption(index)}
                          />
                        }
                        label="Default"
                      />
                    </Grid>
                    <Grid item xs={12} sm={1}>
                      <IconButton
                        onClick={() => removeValidationOption(index)}
                        color="error"
                        size="small"
                      >
                        <Delete />
                      </IconButton>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            ))}

            {errors.options && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {errors.options}
              </Alert>
            )}
          </Grid>
        )}

        {/* Form Actions */}
        <Grid item xs={12}>
          <Divider sx={{ my: 2 }} />
          <Box display="flex" justifyContent="flex-end" gap={2}>
            <Button
              variant="outlined"
              startIcon={<Cancel />}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<Save />}
            >
              {attribute ? 'Update' : 'Create'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export { AccountAttributeForm };
