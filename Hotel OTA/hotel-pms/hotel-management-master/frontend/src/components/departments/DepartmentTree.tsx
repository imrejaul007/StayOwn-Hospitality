import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  Menu,
  MenuItem,
  Alert,
  CircularProgress,
  Avatar,
  Collapse
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  MoreVert as MoreVertIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { TreeView, TreeItem } from '@mui/lab';
import { departmentService } from '../../services/departmentService';

interface Department {
  _id: string;
  name: string;
  code: string;
  departmentType: string;
  status: string;
  parentDepartment?: string;
  level: number;
  staffing: {
    headOfDepartment?: {
      name: string;
      email: string;
    };
    currentStaff: number;
    totalPositions: number;
  };
  analytics: {
    efficiency: number;
    totalTasks: number;
    completedTasks: number;
  };
  children?: Department[];
}

interface DepartmentTreeProps {
  onEditDepartment?: (department: Department) => void;
  onDeleteDepartment?: (departmentId: string) => void;
  onCreateSubdepartment?: (parentId: string) => void;
  onViewDetails?: (department: Department) => void;
}

const DepartmentTree: React.FC<DepartmentTreeProps> = ({
  onEditDepartment,
  onDeleteDepartment,
  onCreateSubdepartment,
  onViewDetails
}) => {
  const [hierarchy, setHierarchy] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<string[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);

  useEffect(() => {
    loadHierarchy();
  }, []);

  const loadHierarchy = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await departmentService.getDepartmentHierarchy();
      setHierarchy(response.data);
    } catch (err: unknown) {
      setError(err.response?.data?.message || 'Failed to load department hierarchy');
    } finally {
      setLoading(false);
    }
  };

  const handleNodeToggle = (event: React.SyntheticEvent, nodeIds: string[]) => {
    setExpandedNodes(nodeIds);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, department: Department) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedDepartment(department);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedDepartment(null);
  };

  const getDepartmentTypeColor = (type: string): string => {
    const colors: { [key: string]: string } = {
      front_office: '#2196F3',
      housekeeping: '#4CAF50',
      food_beverage: '#FF9800',
      maintenance: '#795548',
      security: '#F44336',
      finance: '#9C27B0',
      hr: '#3F51B5',
      marketing: '#E91E63',
      management: '#607D8B',
      spa_wellness: '#00BCD4',
      concierge: '#CDDC39',
      business_center: '#8BC34A',
      other: '#9E9E9E'
    };
    return colors[type] || colors.other;
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'warning';
      case 'suspended': return 'error';
      case 'archived': return 'default';
      default: return 'default';
    }
  };

  const renderDepartmentNode = (department: Department) => {
    const staffOccupancy = department.staffing.totalPositions > 0 
      ? (department.staffing.currentStaff / department.staffing.totalPositions * 100).toFixed(0)
      : '0';

    const completionRate = department.analytics.totalTasks > 0
      ? (department.analytics.completedTasks / department.analytics.totalTasks * 100).toFixed(0)
      : '0';

    return (
      <TreeItem
        key={department._id}
        nodeId={department._id}
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
            <Avatar
              sx={{ 
                width: 32, 
                height: 32, 
                bgcolor: getDepartmentTypeColor(department.departmentType),
                mr: 2,
                fontSize: '0.75rem'
              }}
            >
              {department.code}
            </Avatar>
            
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle2" component="div">
                {department.name}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Chip 
                  label={department.departmentType.replace('_', ' ')}
                  size="small"
                  sx={{ 
                    fontSize: '0.65rem', 
                    height: 20,
                    bgcolor: getDepartmentTypeColor(department.departmentType),
                    color: 'white'
                  }}
                />
                <Chip 
                  label={department.status}
                  size="small"
                  color={getStatusColor(department.status)}
                  sx={{ fontSize: '0.65rem', height: 20 }}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mr: 1 }}>
              <Tooltip title={`Staff: ${department.staffing.currentStaff}/${department.staffing.totalPositions} (${staffOccupancy}%)`}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {department.staffing.currentStaff}/{department.staffing.totalPositions}
                  </Typography>
                </Box>
              </Tooltip>

              <Tooltip title={`Efficiency: ${department.analytics.efficiency.toFixed(1)}%`}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <BusinessIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {department.analytics.efficiency.toFixed(1)}%
                  </Typography>
                </Box>
              </Tooltip>

              <Tooltip title={`Tasks: ${completionRate}% completed`}>
                <Typography variant="caption" color="text.secondary">
                  {completionRate}%
                </Typography>
              </Tooltip>

              <IconButton
                size="small"
                onClick={(e) => handleMenuOpen(e, department)}
                sx={{ ml: 1 }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        }
      >
        {department.children && department.children.map(child => renderDepartmentNode(child))}
      </TreeItem>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Department Hierarchy</Typography>
          <Tooltip title="Expand All">
            <IconButton 
              onClick={() => {
                const getAllNodeIds = (departments: Department[]): string[] => {
                  let ids: string[] = [];
                  departments.forEach(dept => {
                    ids.push(dept._id);
                    if (dept.children) {
                      ids = ids.concat(getAllNodeIds(dept.children));
                    }
                  });
                  return ids;
                };
                setExpandedNodes(getAllNodeIds(hierarchy));
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {hierarchy.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <BusinessIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Departments Found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create your first department to get started
            </Typography>
          </Box>
        ) : (
          <TreeView
            expanded={expandedNodes}
            onNodeToggle={handleNodeToggle}
            defaultCollapseIcon={<ExpandLessIcon />}
            defaultExpandIcon={<ExpandMoreIcon />}
            sx={{ flexGrow: 1, maxWidth: '100%', overflowY: 'auto' }}
          >
            {hierarchy.map(department => renderDepartmentNode(department))}
          </TreeView>
        )}

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          onClick={handleMenuClose}
        >
          <MenuItem 
            onClick={() => selectedDepartment && onViewDetails?.(selectedDepartment)}
          >
            <ViewIcon sx={{ mr: 1, fontSize: 20 }} />
            View Details
          </MenuItem>
          <MenuItem 
            onClick={() => selectedDepartment && onEditDepartment?.(selectedDepartment)}
          >
            <EditIcon sx={{ mr: 1, fontSize: 20 }} />
            Edit Department
          </MenuItem>
          <MenuItem 
            onClick={() => selectedDepartment && onCreateSubdepartment?.(selectedDepartment._id)}
          >
            <AddIcon sx={{ mr: 1, fontSize: 20 }} />
            Add Subdepartment
          </MenuItem>
          <MenuItem 
            onClick={() => selectedDepartment && onDeleteDepartment?.(selectedDepartment._id)}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
            Delete Department
          </MenuItem>
        </Menu>
      </CardContent>
    </Card>
  );
};

export default DepartmentTree;