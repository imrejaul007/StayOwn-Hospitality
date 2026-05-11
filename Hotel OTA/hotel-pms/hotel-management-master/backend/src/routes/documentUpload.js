import express from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import Document from '../models/Document.js';
import DocumentRequirement from '../models/DocumentRequirement.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Booking from '../models/Booking.js';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();
const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per 15 minutes per IP
  message: { status: 'error', message: 'Too many upload attempts. Please try again later.' }
});

const resolveScopedHotelId = (req, requestedPropertyId) => {
  const isManagerOrAdmin = ['admin', 'manager'].includes(req.user.role);
  if (!isManagerOrAdmin) {
    return req.user.hotelId;
  }

  if (requestedPropertyId && String(requestedPropertyId) !== String(req.user.hotelId)) {
    throw new ApplicationError('Property access mismatch for current tenant context', 403);
  }

  return req.user.hotelId;
};

// Ensure uploads directory exists
const createUploadDirectories = () => {
  const baseDir = path.join(process.cwd(), 'uploads', 'documents');
  const dirs = [
    'guests',
    'staff',
    'guests/temp',
    'staff/temp'
  ];

  dirs.forEach(dir => {
    const fullPath = path.join(baseDir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
};

createUploadDirectories();

// Enhanced storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { user } = req;

    // Determine user type from authenticated user only
    const actualUserType = user.role === 'staff' ? 'staff' : 'guest';

    const baseDir = path.join(process.cwd(), 'uploads', 'documents');
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    let uploadDir;
    if (actualUserType === 'staff') {
      uploadDir = path.join(baseDir, 'staff', String(year), month, user._id.toString());
    } else {
      uploadDir = path.join(baseDir, 'guests', String(year), month, user._id.toString());
    }

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate secure filename
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(16).toString('hex');
    const fileExtension = path.extname(file.originalname).toLowerCase();
    // Remove the extension from the original name before sanitizing to avoid double extensions
    const baseName = path.basename(file.originalname, fileExtension);
    const sanitizedBaseName = baseName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 100); // Cap filename length

    const fileName = `doc-${uniqueSuffix}-${sanitizedBaseName}${fileExtension}`;
    cb(null, fileName);
  }
});

// Known magic byte signatures for allowed file types.
// Checked after multer writes the file so we can read actual bytes — prevents
// MIME-type spoofing where a client sends a script with Content-Type: image/jpeg.
const MAGIC_SIGNATURES = [
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4E, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header (WebP starts with RIFF....WEBP)
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  // DOC / DOCX both start with the OLE/PK signature — specific type confirmed by extension
  { mime: 'application/msword', bytes: [0xD0, 0xCF, 0x11, 0xE0] },
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: [0x50, 0x4B, 0x03, 0x04] } // PK zip
];

/**
 * Read the first N bytes of a file from the stream buffer.
 * Multer passes a `stream` — we need to read from disk after writing, or use a memory
 * buffer approach. Since multer diskStorage writes the file before the callback returns,
 * we validate in the post-upload handler instead (see upload middleware below).
 */
async function validateMagicBytes(filePath, declaredMime) {
  const MAX_HEADER_BYTES = 8;
  const buffer = Buffer.alloc(MAX_HEADER_BYTES);
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const { bytesRead } = fs.readSync(fd, buffer, 0, MAX_HEADER_BYTES, 0);
    if (bytesRead < 2) return false;
    const sig = MAGIC_SIGNATURES.find(s => s.mime === declaredMime);
    if (!sig) return false;
    return sig.bytes.every((byte, i) => buffer[i] === byte);
  } catch {
    return false;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* ignore */ }
  }
}

// Enhanced file filter — MIME allowlist check (magic bytes verified post-write)
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  // Normalise image/jpg → image/jpeg for consistent magic-byte lookup
  const normalisedMime = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
  file._normalisedMime = normalisedMime;

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApplicationError(
      `File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
      400
    ));
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files per request
  },
  fileFilter: fileFilter
});

// All routes require authentication, tenant isolation, and property access
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('documentUpload', 'baseAccess'));

/**
 * @swagger
 * /api/v1/documents/upload:
 *   post:
 *     summary: Upload a document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *               category:
 *                 type: string
 *               documentType:
 *                 type: string
 *               description:
 *                 type: string
 *               userType:
 *                 type: string
 *                 enum: [guest, staff]
 *               bookingId:
 *                 type: string
 *               departmentId:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               expiryDate:
 *                 type: string
 *                 format: date
 */
router.post('/upload',
  uploadRateLimiter,
  validate(mutationBaselineSchema),
  upload.single('document'),
  catchAsync(async (req, res) => {
    const {
      category,
      documentType,
      description,
      bookingId,
      departmentId,
      priority = 'medium',
      expiryDate,
      tags
    } = req.body;

    const { _id: userId, hotelId, role } = req.user;

    if (!req.file) {
      throw new ApplicationError('No document uploaded', 400);
    }

    // SECURITY: Verify magic bytes match declared MIME type to prevent content-type spoofing.
    // A client can lie about Content-Type; the actual file bytes cannot be faked this way.
    const normalisedMime = req.file._normalisedMime || req.file.mimetype;
    const magicValid = await validateMagicBytes(req.file.path, normalisedMime);
    if (!magicValid) {
      // Remove the malicious/mismatched file before rejecting
      try { fs.unlinkSync(req.file.path); } catch { /* ignore cleanup error */ }
      throw new ApplicationError('File content does not match the declared file type', 400);
    }

    // Validate user type from authenticated role only
    const actualUserType = role === 'staff' ? 'staff' : 'guest';

    // Validate category and document type are provided
    if (!category || !documentType) {
      throw new ApplicationError('Category and document type are required', 400);
    }

    // Get client IP and device info
    const ipAddress = req.ip || req.connection.remoteAddress;
    const deviceInfo = {
      userAgent: req.get('user-agent'),
      platform: req.get('sec-ch-ua-platform'),
      browser: req.get('sec-ch-ua')
    };

    // Create document record
    const documentData = {
      userId,
      userType: actualUserType,
      hotelId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: req.file.path,
      category,
      documentType,
      description: description || '',
      priority,
      uploadedBy: userId,
      uploadSource: 'web',
      ipAddress,
      deviceInfo,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : []
    };

    // Add context-specific fields
    if (actualUserType === 'guest' && bookingId) {
      const ownsBooking = await Booking.exists({
        _id: bookingId,
        userId,
        hotelId
      });
      if (!ownsBooking) {
        throw new ApplicationError('Invalid booking context for document upload', 403);
      }
      documentData.bookingId = bookingId;
    }

    if (actualUserType === 'staff') {
      // Use user's department or provided department ID
      documentData.departmentId = departmentId || req.user.departmentId;
    }

    if (expiryDate) {
      documentData.expiryDate = new Date(expiryDate);
    }

    const document = new Document(documentData);

    // Add initial audit entry
    await document.addAuditEntry('upload', userId, {
      originalName: req.file.originalname,
      fileSize: req.file.size,
      category,
      documentType
    }, ipAddress, req.get('user-agent'));

    await document.save();

    // Remove sensitive data from response
    const responseDoc = document.toJSON();
    delete responseDoc.filePath;

    res.status(201).json({
      status: 'success',
      data: {
        document: responseDoc,
        message: 'Document uploaded successfully'
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents/bulk-upload:
 *   post:
 *     summary: Upload multiple documents
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.post('/bulk-upload',
  uploadRateLimiter,
  validate(mutationBaselineSchema),
  upload.array('documents', 10),
  catchAsync(async (req, res) => {
    const { metadata } = req.body; // JSON string with file-specific metadata
    const { _id: userId, hotelId, role } = req.user;

    if (!req.files || req.files.length === 0) {
      throw new ApplicationError('No documents uploaded', 400);
    }

    let parsedMetadata = {};
    try {
      parsedMetadata = JSON.parse(metadata || '{}');
    } catch (error) {
      throw new ApplicationError('Invalid metadata format', 400);
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    const uploadedDocuments = [];

    // Process each uploaded file
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const fileMetadata = parsedMetadata[i] || {};

      // SECURITY: Verify magic bytes match declared MIME type for each bulk-uploaded file.
      // This mirrors the validation in the single-upload route to prevent content-type spoofing.
      const normalisedMime = file._normalisedMime || file.mimetype;
      const magicValid = await validateMagicBytes(file.path, normalisedMime);
      if (!magicValid) {
        // Remove the malicious/mismatched file and all previously written files before rejecting
        for (const f of req.files) {
          try { fs.unlinkSync(f.path); } catch { /* ignore cleanup error */ }
        }
        throw new ApplicationError(`File ${i + 1}: content does not match the declared file type`, 400);
      }

      const documentData = {
        userId,
        userType: role === 'staff' ? 'staff' : 'guest',
        hotelId,
        filename: file.filename,
        originalName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        filePath: file.path,
        category: fileMetadata.category || 'identity_proof',
        documentType: fileMetadata.documentType || 'General Document',
        description: fileMetadata.description || '',
        priority: fileMetadata.priority || 'medium',
        uploadedBy: userId,
        uploadSource: 'web',
        ipAddress,
        deviceInfo: { userAgent }
      };

      // Add context-specific fields
      if (role === 'staff') {
        documentData.departmentId = fileMetadata.departmentId || req.user.departmentId;
      } else if (fileMetadata.bookingId) {
        const ownsBooking = await Booking.exists({
          _id: fileMetadata.bookingId,
          userId,
          hotelId
        });
        if (!ownsBooking) {
          throw new ApplicationError('Invalid booking context in bulk upload metadata', 403);
        }
        documentData.bookingId = fileMetadata.bookingId;
      }

      if (fileMetadata.expiryDate) {
        documentData.expiryDate = new Date(fileMetadata.expiryDate);
      }

      const document = new Document(documentData);
      await document.addAuditEntry('upload', userId, {
        originalName: file.originalname,
        bulkUpload: true,
        fileIndex: i
      }, ipAddress, userAgent);

      await document.save();
      uploadedDocuments.push(document.toJSON());
    }

    res.status(201).json({
      status: 'success',
      data: {
        documents: uploadedDocuments,
        message: `Successfully uploaded ${uploadedDocuments.length} document(s)`
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents:
 *   get:
 *     summary: Get user's documents
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authorizePolicy('documentUpload', 'baseAccess'), catchAsync(async (req, res) => {
  const {
    status,
    category,
    userType,
    bookingId,
    search,
    page,
    limit = 20,
    skip = 0,
  } = req.query;

  const parsedLimit = Math.min(parseInt(limit) || 20, 100);
  const parsedPage = Math.max(parseInt(page) || 1, 1);
  const parsedSkip = page ? (parsedPage - 1) * parsedLimit : (parseInt(skip) || 0);
  const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // SECURITY: Allowlist sort fields to prevent NoSQL injection via unsanitized sort param.
  const ALLOWED_SORT_FIELDS = ['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'originalName', '-originalName', 'status', '-status'];
  const rawSortBy = req.query.sortBy || '-createdAt';
  const sortBy = ALLOWED_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : '-createdAt';

  const query = {
    userId: req.user._id,
    hotelId: req.user.hotelId,
    isActive: true,
    isDeleted: false
  };
  if (status) query.status = status;
  if (category) query.category = category;
  if (userType) query.userType = userType;
  if (bookingId) {
    if (!objectIdPattern.test(String(bookingId))) {
      throw new ApplicationError('Invalid bookingId filter', 400);
    }
    query.bookingId = bookingId;
  }
  if (search && String(search).trim()) {
    const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
    query.$or = [
      { originalName: rx },
      { documentType: rx },
      { description: rx }
    ];
  }

  const [documents, totalCount] = await Promise.all([
    Document.find(query)
      .sort(sortBy)
      .skip(parsedSkip)
      .limit(parsedLimit)
      .populate('bookingId', 'bookingNumber checkIn checkOut')
      .lean(),
    Document.countDocuments(query)
  ]);

  res.json({
    status: 'success',
    results: documents.length,
    totalCount,
    totalPages: Math.ceil(totalCount / parsedLimit),
    page: Math.floor(parsedSkip / parsedLimit) + 1,
    limit: parsedLimit,
    data: { documents }
  });
}));

/**
 * @swagger
 * /api/v1/documents/admin/queue:
 *   get:
 *     summary: Get admin document verification queue with stats
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/admin/queue',
  authorizePolicy('documentUpload', 'managerAccess'),
  catchAsync(async (req, res) => {
    const {
      userType = 'guest',
      status = 'pending',
      propertyId,
      page,
      limit = 20,
      skip = 0
    } = req.query;

    const parsedLimit = Math.min(parseInt(limit) || 20, 100);
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const parsedSkip = page ? (parsedPage - 1) * parsedLimit : (parseInt(skip) || 0);

    const hotelId = resolveScopedHotelId(req, propertyId);
    const baseFilter = {
      hotelId,
      isActive: true,
      isDeleted: { $ne: true }
    };

    const docFilter = { ...baseFilter };
    if (userType && userType !== 'all') {
      docFilter.userType = userType;
    }
    if (status && status !== 'all') {
      docFilter.status = status;
    }

    const documents = await Document.find(docFilter)
      .populate('userId', 'name email role')
      .populate('verificationDetails.verifiedBy', 'name')
      .populate('departmentId', 'name')
      .populate('bookingId', 'confirmationNumber')
      .sort('-createdAt')
      .skip(parsedSkip)
      .limit(parsedLimit)
      .lean();

    const [filteredCount, total, pending, verified, rejected, expired, renewalRequired, guestDocs, staffDocs] = await Promise.all([
      Document.countDocuments(docFilter),
      Document.countDocuments(baseFilter),
      Document.countDocuments({ ...baseFilter, status: 'pending' }),
      Document.countDocuments({ ...baseFilter, status: 'verified' }),
      Document.countDocuments({ ...baseFilter, status: 'rejected' }),
      Document.countDocuments({ ...baseFilter, status: 'expired' }),
      Document.countDocuments({ ...baseFilter, status: 'renewal_required' }),
      Document.countDocuments({ ...baseFilter, userType: 'guest' }),
      Document.countDocuments({ ...baseFilter, userType: 'staff' }),
    ]);

    res.json({
      status: 'success',
      documents,
      totalCount: filteredCount,
      totalPages: Math.ceil(filteredCount / parsedLimit),
      page: parsedPage,
      limit: parsedLimit,
      totalStats: {
        total, pending, verified, rejected, expired, renewalRequired, guestDocs, staffDocs
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents/pending-verifications:
 *   get:
 *     summary: Get pending document verifications (Admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/pending-verifications',
  authorizePolicy('documentUpload', 'managerAccess'),
  catchAsync(async (req, res) => {
    const {
      userType,
      departmentId,
      priority,
      page,
      limit = 20,
      skip = 0
    } = req.query;

    const parsedLimit = Math.min(parseInt(limit) || 20, 100);
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const parsedSkip = page ? (parsedPage - 1) * parsedLimit : (parseInt(skip) || 0);

    // SECURITY: Validate departmentId as ObjectId to prevent CastError leakage.
    if (departmentId && !mongoose.Types.ObjectId.isValid(departmentId)) {
      throw new ApplicationError('Invalid departmentId filter value', 400);
    }

    const countQuery = { hotelId: req.user.hotelId, status: 'pending', isActive: true, isDeleted: false };
    if (userType) countQuery.userType = userType;
    if (departmentId) countQuery.departmentId = departmentId;
    if (priority) countQuery.priority = priority;

    const [documents, totalCount] = await Promise.all([
      Document.getPendingVerifications(req.user.hotelId, {
        userType,
        departmentId,
        priority,
        limit: parsedLimit,
        skip: parsedSkip
      }),
      Document.countDocuments(countQuery)
    ]);

    res.json({
      status: 'success',
      results: documents.length,
      totalCount,
      totalPages: Math.ceil(totalCount / parsedLimit),
      page: parsedPage,
      limit: parsedLimit,
      data: { documents }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents/analytics:
 *   get:
 *     summary: Get document analytics and statistics
 *     tags: [Documents]
 */
router.get('/analytics', authorizePolicy('documentUpload', 'managerAccess'), catchAsync(async (req, res) => {
  const { period = '30d', userType = 'all', propertyId } = req.query;

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  const days = parseInt(period.replace(/[^0-9]/g, '')) || 30;
  startDate.setDate(startDate.getDate() - days);

  // Always enforce tenant isolation via hotelId
  const hotelId = resolveScopedHotelId(req, propertyId);
  if (!hotelId) {
    throw new ApplicationError('Hotel ID is required', 400);
  }
  const matchQuery = {
    hotelId: new mongoose.Types.ObjectId(String(hotelId)),
    createdAt: { $gte: startDate, $lte: endDate },
    isActive: true,
    isDeleted: { $ne: true }
  };
  if (userType && userType !== 'all') {
    matchQuery.userType = userType;
  }

  const [totalDocs, statusBreakdown, typeCounts] = await Promise.all([
    Document.countDocuments(matchQuery),
    Document.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Document.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$documentType', count: { $sum: 1 } } }
    ])
  ]);

  const statusMap = statusBreakdown.reduce((acc, item) => {
    acc[item._id || 'unknown'] = item.count;
    return acc;
  }, {});

  const verified = statusMap.verified || 0;
  const pending = statusMap.pending || 0;
  const rejected = statusMap.rejected || 0;
  const expired = statusMap.expired || 0;

  res.json({
    status: 'success',
    analytics: {
      overview: {
        totalDocuments: totalDocs,
        pendingVerification: pending,
        verifiedDocuments: verified,
        rejectedDocuments: rejected,
        expiredDocuments: expired,
        renewalRequests: 0,
        complianceRate: totalDocs > 0 ? (verified / totalDocs) * 100 : 0,
        avgVerificationTime: 0
      },
      trends: {
        uploadsThisMonth: totalDocs,
        uploadsLastMonth: 0,
        verificationsThisMonth: verified + rejected,
        verificationsLastMonth: 0,
        rejectionsThisMonth: rejected,
        rejectionsLastMonth: 0
      },
      documentsByType: typeCounts.map(t => ({ _id: t._id, count: t.count })),
      verificationTimeline: [],
      departmentBreakdown: [],
      expiryForecast: []
    }
  });
}));

/**
 * @swagger
 * /api/v1/documents/{id}:
 *   get:
 *     summary: Get specific document details
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', catchAsync(async (req, res) => {
  // Guard: reject non-ObjectId strings (e.g. "analytics" matched by this catch-all)
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError(`Invalid document ID: ${req.params.id}`, 400);
  }
  const document = await Document.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  })
    .populate('userId', 'name email role')
    .populate('uploadedBy', 'name email')
    .populate('verificationDetails.verifiedBy', 'name email')
    .populate('departmentId', 'name code')
    .populate('bookingId', 'bookingNumber checkIn checkOut');

  if (!document) {
    throw new ApplicationError('Document not found', 404);
  }

  // Check if user can view this document
  if (!document.canBeViewedBy(req.user, req.user.departmentId)) {
    throw new ApplicationError('You do not have permission to view this document', 403);
  }

  // Log access
  await document.addAuditEntry('view', req.user._id, {
    viewedBy: req.user.name
  }, req.ip, req.get('user-agent'));

  res.json({
    status: 'success',
    data: { document }
  });
}));

/**
 * @swagger
 * /api/v1/documents/{id}/download:
 *   get:
 *     summary: Download document file
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/download', catchAsync(async (req, res) => {
  // SECURITY: Validate ObjectId format to prevent CastError stack-trace leakage.
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ApplicationError('Document not found', 404);
  }
  const document = await Document.findOne({
    _id: req.params.id,
    hotelId: req.user.hotelId
  }).select('+filePath');

  if (!document) {
    throw new ApplicationError('Document not found', 404);
  }

  // Check if user can view this document
  if (!document.canBeViewedBy(req.user, req.user.departmentId)) {
    throw new ApplicationError('You do not have permission to download this document', 403);
  }

  const filePath = document.filePath;
  const uploadsBase = path.resolve(process.cwd(), 'uploads');

  // Prevent path traversal -- ensure file is within the uploads directory
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(uploadsBase)) {
    throw new ApplicationError('Invalid file path', 400);
  }

  // Check if file exists
  if (!fs.existsSync(resolvedPath)) {
    throw new ApplicationError('Document file not found', 404);
  }

  // Log download
  await document.addAuditEntry('download', req.user._id, {
    downloadedBy: req.user.name
  }, req.ip, req.get('user-agent'));

  // Set appropriate headers
  const ext = path.extname(document.originalName).toLowerCase();
  const contentTypeMap = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
  };

  // Sanitize filename for Content-Disposition header to prevent header injection
  const sanitizedName = document.originalName
    .replace(/[^\w.\-() ]/g, '_')
    .substring(0, 255);
  res.setHeader('Content-Type', contentTypeMap[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${sanitizedName}"`);
  res.setHeader('Cache-Control', 'private, no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Stream the file
  const fileStream = fs.createReadStream(resolvedPath);
  fileStream.pipe(res);
}));

/**
 * @swagger
 * /api/v1/documents/{id}/verify:
 *   patch:
 *     summary: Verify a document (Admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/verify',
  authorizePolicy('documentUpload', 'managerAccess'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { comments, confidenceLevel = 5 } = req.body;

    const document = await Document.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    });
    if (!document) {
      throw new ApplicationError('Document not found', 404);
    }

    if (document.status !== 'pending') {
      throw new ApplicationError('Only pending documents can be verified', 400);
    }

    await document.verify(req.user._id, comments, confidenceLevel);

    res.json({
      status: 'success',
      data: {
        document,
        message: 'Document verified successfully'
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents/{id}/reject:
 *   patch:
 *     summary: Reject a document (Admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/reject',
  authorizePolicy('documentUpload', 'managerAccess'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      throw new ApplicationError('Rejection reason is required', 400);
    }

    const document = await Document.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    });
    if (!document) {
      throw new ApplicationError('Document not found', 404);
    }

    if (document.status !== 'pending') {
      throw new ApplicationError('Only pending documents can be rejected', 400);
    }

    await document.reject(req.user._id, rejectionReason);

    res.json({
      status: 'success',
      data: {
        document,
        message: 'Document rejected'
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents/{id}/request-renewal:
 *   patch:
 *     summary: Request document renewal (Admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/request-renewal',
  authorizePolicy('documentUpload', 'managerAccess'),
  validate(mutationBaselineSchema),
  catchAsync(async (req, res) => {
    const document = await Document.findOne({
      _id: req.params.id,
      hotelId: req.user.hotelId
    });
    if (!document) {
      throw new ApplicationError('Document not found', 404);
    }

    if (!['verified', 'expired'].includes(document.status)) {
      throw new ApplicationError('Only verified or expired documents can be marked for renewal', 400);
    }

    await document.markForRenewal(req.user._id, req.body.notes || 'Renewal requested by admin');

    res.json({
      status: 'success',
      data: {
        document,
        message: 'Document marked for renewal'
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents/{id}:
 *   patch:
 *     summary: Update document metadata
 *     tags: [Documents]
 */
router.patch('/:id', validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const { description, tags, category, documentType, expiryDate } = req.body;

  // Build ownership query with tenant isolation
  const ownershipQuery = { _id: req.params.id, hotelId: req.user.hotelId };
  if (req.user.role !== 'admin') {
    ownershipQuery.userId = req.user._id;
  }

  // Build update fields
  const setFields = { updatedBy: req.user._id };
  if (description !== undefined) setFields.description = description;
  if (tags !== undefined) setFields.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
  if (category !== undefined && req.user.role === 'admin') setFields.category = category;
  if (documentType !== undefined && req.user.role === 'admin') setFields.documentType = documentType;
  if (expiryDate !== undefined && req.user.role === 'admin') setFields.expiryDate = new Date(expiryDate);

  const document = await Document.findOneAndUpdate(
    ownershipQuery,
    {
      $set: setFields,
      $push: {
        auditLog: {
          action: 'update',
          performedBy: req.user._id,
          details: { newValues: { description, tags, category, documentType, expiryDate } },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          performedAt: new Date()
        }
      }
    },
    { new: true, runValidators: true }
  );

  if (!document) {
    const exists = await Document.findById(req.params.id).lean();
    if (!exists) {
      throw new ApplicationError('Document not found', 404);
    }
    throw new ApplicationError('You can only update your own documents', 403);
  }

  res.json({
    status: 'success',
    data: {
      document,
      message: 'Document updated successfully'
    }
  });
}));

/**
 * @swagger
 * /api/v1/documents/{id}:
 *   delete:
 *     summary: Delete a document
 *     tags: [Documents]
 */
router.delete('/:id', validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  // Build ownership query with tenant isolation
  const ownershipQuery = { _id: req.params.id, hotelId: req.user.hotelId };
  if (req.user.role !== 'admin') {
    ownershipQuery.userId = req.user._id;
  }

  const document = await Document.findOneAndUpdate(
    ownershipQuery,
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user._id,
        isActive: false
      },
      $push: {
        auditLog: {
          action: 'delete',
          performedBy: req.user._id,
          details: { deletedBy: req.user.name },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          performedAt: new Date()
        }
      }
    },
    { new: true }
  );

  if (!document) {
    const exists = await Document.findById(req.params.id).lean();
    if (!exists) {
      throw new ApplicationError('Document not found', 404);
    }
    throw new ApplicationError('You can only delete your own documents', 403);
  }

  res.json({
    status: 'success',
    message: 'Document deleted successfully'
  });
}));

/**
 * @swagger
 * /api/v1/documents/staff/{staffId}:
 *   get:
 *     summary: Get staff member's documents (Admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/staff/:staffId',
  authorizePolicy('documentUpload', 'managerAccess'),
  catchAsync(async (req, res) => {
    const { staffId } = req.params;
    const { status, category, limit = 20, skip = 0 } = req.query;

    // Verify the user is actually a staff member within the same hotel
    const staffUser = await User.findOne({
      _id: staffId,
      hotelId: req.user.hotelId
    }).lean();
    if (!staffUser || staffUser.role !== 'staff') {
      throw new ApplicationError('Staff member not found', 404);
    }

    const parsedLimit = Math.min(parseInt(limit) || 20, 100);
    const parsedSkip = parseInt(skip) || 0;

    const documents = await Document.getDocumentsByUser(staffId, {
      hotelId: req.user.hotelId,
      userType: 'staff',
      status,
      category,
      limit: parsedLimit,
      skip: parsedSkip
    });

    res.json({
      status: 'success',
      results: documents.length,
      data: {
        documents,
        staffMember: {
          _id: staffUser._id,
          name: staffUser.name,
          email: staffUser.email,
          departmentId: staffUser.departmentId
        }
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents/guest/{guestId}:
 *   get:
 *     summary: Get guest's documents (Admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/guest/:guestId',
  authorizePolicy('documentUpload', 'staffAccess'),
  catchAsync(async (req, res) => {
    const { guestId } = req.params;
    const { status, category, bookingId, limit = 20, skip = 0 } = req.query;

    // Verify the user exists within the same hotel
    const guestUser = await User.findOne({
      _id: guestId,
      hotelId: req.user.hotelId
    }).lean();
    if (!guestUser) {
      throw new ApplicationError('Guest not found', 404);
    }

    const parsedLimit = Math.min(parseInt(limit) || 20, 100);
    const parsedSkip = parseInt(skip) || 0;

    const baseQuery = {
      hotelId: req.user.hotelId,
      userId: guestId,
      userType: 'guest',
      isActive: true,
      isDeleted: false
    };

    if (status) {
      baseQuery.status = status;
    }

    if (category) {
      baseQuery.category = category;
    }

    if (bookingId) {
      baseQuery.bookingId = bookingId;
    }

    const candidateDocuments = await Document.find(baseQuery)
      .populate('verificationDetails.verifiedBy', 'name email')
      .populate('departmentId', 'name code')
      .populate('bookingId', 'bookingNumber checkIn checkOut')
      .sort('-createdAt')
      .skip(parsedSkip)
      .limit(parsedLimit);

    // Enforce per-document ACL checks for this endpoint.
    const documents = candidateDocuments.filter((document) =>
      document.canBeViewedBy(req.user, req.user.departmentId)
    );

    res.json({
      status: 'success',
      results: documents.length,
      data: {
        documents,
        guest: {
          _id: guestUser._id,
          name: guestUser.name,
          email: guestUser.email
        }
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/documents/requirements/{userType}:
 *   get:
 *     summary: Get document requirements for user type
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/requirements/:userType', catchAsync(async (req, res) => {
  const { userType } = req.params;
  const { departmentId, bookingType, mandatory } = req.query;

  if (!['guest', 'staff'].includes(userType)) {
    throw new ApplicationError('Invalid user type. Must be guest or staff', 400);
  }

  const additionalContext = {
    departmentId,
    bookingType,
    employmentType: req.query.employmentType,
    jobRole: req.query.jobRole
  };

  let requirements = await DocumentRequirement.getRequirementsForUser(
    req.user.hotelId,
    userType,
    additionalContext
  );

  // Filter applicable requirements (use distinct variable name to avoid shadowing Express req)
  const currentUser = req.user;
  requirements = requirements.filter(requirement => requirement.isApplicableForUser(
    { role: userType, departmentId, ...currentUser },
    additionalContext
  ));

  // Filter by mandatory if requested
  if (mandatory === 'true') {
    requirements = requirements.filter(requirement => requirement.isMandatory);
  }

  res.json({
    status: 'success',
    results: requirements.length,
    data: { requirements }
  });
}));

/**
 * @swagger
 * /api/v1/documents/analytics/compliance:
 *   get:
 *     summary: Get document compliance analytics (Admin only)
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/analytics/compliance',
  authorizePolicy('documentUpload', 'managerAccess'),
  catchAsync(async (req, res) => {
    const {
      userType,
      departmentId,
      startDate,
      endDate
    } = req.query;

    const stats = await Document.getComplianceStats(req.user.hotelId, {
      userType,
      departmentId,
      startDate,
      endDate
    });

    // Get expiring documents
    const expiringDocuments = await Document.getExpiringDocuments(req.user.hotelId, 30);

    res.json({
      status: 'success',
      data: {
        complianceStats: stats[0] || {},
        expiringDocuments,
        summary: {
          totalExpiring: expiringDocuments.length,
          analysisPeriod: {
            startDate,
            endDate,
            userType,
            departmentId
          }
        }
      }
    });
  })
);

export default router;