/**
 * Comprehensive Document Verification Workflow Tests
 *
 * This test suite validates the complete document verification workflow
 * for both guest and staff users, including:
 * - Document upload
 * - Admin verification/rejection
 * - Document viewing with role-based access
 * - Analytics tracking
 * - Compliance monitoring
 */

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../backend/src/server');
const User = require('../backend/src/models/User');
const Document = require('../backend/src/models/Document');
const DocumentRequirement = require('../backend/src/models/DocumentRequirement');

describe('Document Verification Workflow Tests', () => {
  let guestUser, staffUser, adminUser;
  let guestToken, staffToken, adminToken;
  let testDocument;
  let testDocumentRequirement;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/hotel_test');

    // Clean up existing test data
    await User.deleteMany({ email: { $regex: /@test\.com$/ } });
    await Document.deleteMany({});
    await DocumentRequirement.deleteMany({});
  });

  beforeEach(async () => {
    // Create test users
    guestUser = await User.create({
      firstName: 'Test',
      lastName: 'Guest',
      email: 'testguest@test.com',
      password: 'password123',
      role: 'guest',
      phone: '+1234567890',
      isActive: true
    });

    staffUser = await User.create({
      firstName: 'Test',
      lastName: 'Staff',
      email: 'teststaff@test.com',
      password: 'password123',
      role: 'staff',
      phone: '+1234567891',
      isActive: true,
      departmentId: new mongoose.Types.ObjectId()
    });

    adminUser = await User.create({
      firstName: 'Test',
      lastName: 'Admin',
      email: 'testadmin@test.com',
      password: 'password123',
      role: 'admin',
      phone: '+1234567892',
      isActive: true
    });

    // Generate authentication tokens
    guestToken = guestUser.generateAuthToken();
    staffToken = staffUser.generateAuthToken();
    adminToken = adminUser.generateAuthToken();

    // Create test document requirement
    testDocumentRequirement = await DocumentRequirement.create({
      userType: 'guest',
      category: 'identity_proof',
      documentType: 'passport',
      name: 'Passport Verification',
      description: 'Valid passport for identity verification',
      required: true,
      maxSizeMB: 5,
      allowedFormats: ['pdf', 'jpg', 'png'],
      expiryMonths: 60,
      applicableConditions: {
        bookingTypes: ['international']
      },
      isCurrentlyActive: true
    });
  });

  afterEach(async () => {
    // Clean up test data
    await User.deleteMany({ email: { $regex: /@test\.com$/ } });
    await Document.deleteMany({});
    await DocumentRequirement.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Guest Document Workflow', () => {
    test('Guest can view document requirements', async () => {
      const response = await request(app)
        .get('/api/v1/documents/requirements/guest')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(response.body.requirements).toHaveLength(1);
      expect(response.body.requirements[0].name).toBe('Passport Verification');
    });

    test('Guest can upload a document', async () => {
      const response = await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${guestToken}`)
        .field('category', 'identity_proof')
        .field('documentType', 'passport')
        .field('userType', 'guest')
        .field('notes', 'Test passport upload')
        .attach('document', Buffer.from('fake-pdf-content'), 'test-passport.pdf')
        .expect(201);

      expect(response.body.message).toBe('Document uploaded successfully');
      expect(response.body.document.status).toBe('pending');
      expect(response.body.document.category).toBe('identity_proof');

      testDocument = response.body.document;
    });

    test('Guest can view their uploaded documents', async () => {
      // First upload a document
      await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${guestToken}`)
        .field('category', 'identity_proof')
        .field('documentType', 'passport')
        .field('userType', 'guest')
        .attach('document', Buffer.from('fake-pdf-content'), 'test-passport.pdf');

      const response = await request(app)
        .get('/api/v1/documents/my-documents?userType=guest')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(response.body.documents).toHaveLength(1);
      expect(response.body.documents[0].userId).toBe(guestUser._id.toString());
    });

    test('Guest cannot view other users documents', async () => {
      // Create another guest and upload a document
      const otherGuest = await User.create({
        firstName: 'Other',
        lastName: 'Guest',
        email: 'otherguest@test.com',
        password: 'password123',
        role: 'guest',
        phone: '+1234567893'
      });

      const otherDoc = await Document.create({
        originalName: 'other-passport.pdf',
        fileName: 'other-passport-123.pdf',
        filePath: '/uploads/guest/2024/01/other-passport-123.pdf',
        category: 'identity_proof',
        documentType: 'passport',
        status: 'pending',
        userType: 'guest',
        userId: otherGuest._id,
        metadata: {
          size: 1024,
          mimeType: 'application/pdf'
        }
      });

      const response = await request(app)
        .get(`/api/v1/documents/${otherDoc._id}/metadata`)
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(403);

      expect(response.body.message).toContain('permission');
    });
  });

  describe('Staff Document Workflow', () => {
    test('Staff can view staff document requirements', async () => {
      // Create staff requirement
      await DocumentRequirement.create({
        userType: 'staff',
        category: 'employment_verification',
        documentType: 'employment_contract',
        name: 'Employment Contract',
        description: 'Signed employment contract',
        required: true,
        maxSizeMB: 10,
        allowedFormats: ['pdf'],
        applicableConditions: {
          departments: [staffUser.departmentId]
        },
        isCurrentlyActive: true
      });

      const response = await request(app)
        .get('/api/v1/documents/requirements/staff')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.requirements).toHaveLength(1);
      expect(response.body.requirements[0].name).toBe('Employment Contract');
    });

    test('Staff can upload employment documents', async () => {
      const response = await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${staffToken}`)
        .field('category', 'employment_verification')
        .field('documentType', 'employment_contract')
        .field('userType', 'staff')
        .field('departmentId', staffUser.departmentId.toString())
        .field('notes', 'Test employment contract')
        .attach('document', Buffer.from('fake-pdf-content'), 'employment-contract.pdf')
        .expect(201);

      expect(response.body.document.status).toBe('pending');
      expect(response.body.document.category).toBe('employment_verification');
      expect(response.body.document.departmentId).toBe(staffUser.departmentId.toString());
    });

    test('Staff can view their department documents', async () => {
      // Upload a staff document first
      await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${staffToken}`)
        .field('category', 'employment_verification')
        .field('documentType', 'employment_contract')
        .field('userType', 'staff')
        .field('departmentId', staffUser.departmentId.toString())
        .attach('document', Buffer.from('fake-pdf-content'), 'employment-contract.pdf');

      const response = await request(app)
        .get('/api/v1/documents/my-documents?userType=staff')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.documents).toHaveLength(1);
      expect(response.body.documents[0].userType).toBe('staff');
    });
  });

  describe('Admin Verification Workflow', () => {
    let guestDocument, staffDocument;

    beforeEach(async () => {
      // Create test documents for verification
      guestDocument = await Document.create({
        originalName: 'guest-passport.pdf',
        fileName: 'guest-passport-123.pdf',
        filePath: '/uploads/guest/2024/01/guest-passport-123.pdf',
        category: 'identity_proof',
        documentType: 'passport',
        status: 'pending',
        userType: 'guest',
        userId: guestUser._id,
        metadata: {
          size: 2048,
          mimeType: 'application/pdf'
        },
        auditLog: [{
          action: 'uploaded',
          performedBy: guestUser._id,
          timestamp: new Date()
        }]
      });

      staffDocument = await Document.create({
        originalName: 'staff-contract.pdf',
        fileName: 'staff-contract-456.pdf',
        filePath: '/uploads/staff/2024/01/staff-contract-456.pdf',
        category: 'employment_verification',
        documentType: 'employment_contract',
        status: 'pending',
        userType: 'staff',
        userId: staffUser._id,
        departmentId: staffUser.departmentId,
        metadata: {
          size: 3072,
          mimeType: 'application/pdf'
        },
        auditLog: [{
          action: 'uploaded',
          performedBy: staffUser._id,
          timestamp: new Date()
        }]
      });
    });

    test('Admin can view all pending documents', async () => {
      const response = await request(app)
        .get('/api/v1/documents/admin/queue?userType=all&status=pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.documents).toHaveLength(2);
      expect(response.body.documents.map(d => d.userType)).toContain('guest');
      expect(response.body.documents.map(d => d.userType)).toContain('staff');
    });

    test('Admin can verify a guest document', async () => {
      const response = await request(app)
        .post(`/api/v1/documents/${guestDocument._id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Document verified successfully',
          expiryMonths: 60
        })
        .expect(200);

      expect(response.body.message).toBe('Document verified successfully');

      // Check document was updated
      const updatedDoc = await Document.findById(guestDocument._id);
      expect(updatedDoc.status).toBe('verified');
      expect(updatedDoc.verifiedBy).toBe(adminUser._id.toString());
      expect(updatedDoc.notes).toBe('Document verified successfully');
      expect(updatedDoc.expiresAt).toBeDefined();
    });

    test('Admin can reject a staff document', async () => {
      const response = await request(app)
        .post(`/api/v1/documents/${staffDocument._id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rejectionReason: 'Document quality is poor',
          notes: 'Please resubmit with better quality'
        })
        .expect(200);

      expect(response.body.message).toBe('Document rejected');

      // Check document was updated
      const updatedDoc = await Document.findById(staffDocument._id);
      expect(updatedDoc.status).toBe('rejected');
      expect(updatedDoc.rejectionReason).toBe('Document quality is poor');
      expect(updatedDoc.notes).toBe('Please resubmit with better quality');
    });

    test('Admin can request document renewal', async () => {
      // First verify the document
      await guestDocument.updateOne({
        status: 'verified',
        verifiedBy: adminUser._id,
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() - 86400000) // Expired yesterday
      });

      const response = await request(app)
        .post(`/api/v1/documents/${guestDocument._id}/request-renewal`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'Document has expired, please renew'
        })
        .expect(200);

      expect(response.body.message).toBe('Renewal requested');

      // Check document was updated
      const updatedDoc = await Document.findById(guestDocument._id);
      expect(updatedDoc.status).toBe('renewal_required');
    });

    test('Admin can filter documents by user type', async () => {
      // Test guest documents only
      const guestResponse = await request(app)
        .get('/api/v1/documents/admin/queue?userType=guest&status=pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(guestResponse.body.documents).toHaveLength(1);
      expect(guestResponse.body.documents[0].userType).toBe('guest');

      // Test staff documents only
      const staffResponse = await request(app)
        .get('/api/v1/documents/admin/queue?userType=staff&status=pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(staffResponse.body.documents).toHaveLength(1);
      expect(staffResponse.body.documents[0].userType).toBe('staff');
    });
  });

  describe('Document Analytics Workflow', () => {
    beforeEach(async () => {
      // Create sample documents for analytics
      const documents = [
        {
          originalName: 'guest1-passport.pdf',
          fileName: 'guest1-passport.pdf',
          filePath: '/uploads/guest/guest1-passport.pdf',
          category: 'identity_proof',
          documentType: 'passport',
          status: 'verified',
          userType: 'guest',
          userId: guestUser._id,
          verifiedBy: adminUser._id,
          verifiedAt: new Date(),
          metadata: { size: 1024, mimeType: 'application/pdf' }
        },
        {
          originalName: 'guest2-visa.pdf',
          fileName: 'guest2-visa.pdf',
          filePath: '/uploads/guest/guest2-visa.pdf',
          category: 'visa',
          documentType: 'tourist_visa',
          status: 'pending',
          userType: 'guest',
          userId: guestUser._id,
          metadata: { size: 2048, mimeType: 'application/pdf' }
        },
        {
          originalName: 'staff1-contract.pdf',
          fileName: 'staff1-contract.pdf',
          filePath: '/uploads/staff/staff1-contract.pdf',
          category: 'employment_verification',
          documentType: 'employment_contract',
          status: 'verified',
          userType: 'staff',
          userId: staffUser._id,
          departmentId: staffUser.departmentId,
          verifiedBy: adminUser._id,
          verifiedAt: new Date(),
          metadata: { size: 3072, mimeType: 'application/pdf' }
        }
      ];

      await Document.insertMany(documents);
    });

    test('Admin can fetch comprehensive analytics', async () => {
      const response = await request(app)
        .get('/api/v1/documents/analytics?period=30d&userType=all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const analytics = response.body.analytics;

      expect(analytics.overview).toBeDefined();
      expect(analytics.overview.totalDocuments).toBe(3);
      expect(analytics.overview.verifiedDocuments).toBe(2);
      expect(analytics.overview.pendingVerification).toBe(1);

      expect(analytics.byUserType).toBeDefined();
      expect(analytics.byUserType.guest.total).toBe(2);
      expect(analytics.byUserType.staff.total).toBe(1);

      expect(analytics.byCategory).toBeDefined();
      expect(analytics.byCategory.length).toBeGreaterThan(0);
    });

    test('Admin can export analytics data', async () => {
      const response = await request(app)
        .get('/api/v1/documents/analytics/export?period=30d&userType=all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    test('Analytics shows compliance rates correctly', async () => {
      const response = await request(app)
        .get('/api/v1/documents/analytics?period=30d&userType=all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const analytics = response.body.analytics;

      // With 2 verified out of 3 total, compliance rate should be ~66.67%
      expect(analytics.overview.complianceRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('Role-Based Access Control', () => {
    let guestDocument, staffDocument;

    beforeEach(async () => {
      guestDocument = await Document.create({
        originalName: 'guest-passport.pdf',
        fileName: 'guest-passport.pdf',
        filePath: '/uploads/guest/guest-passport.pdf',
        category: 'identity_proof',
        documentType: 'passport',
        status: 'verified',
        userType: 'guest',
        userId: guestUser._id,
        viewableByRoles: ['guest', 'admin'],
        metadata: { size: 1024, mimeType: 'application/pdf' }
      });

      staffDocument = await Document.create({
        originalName: 'staff-contract.pdf',
        fileName: 'staff-contract.pdf',
        filePath: '/uploads/staff/staff-contract.pdf',
        category: 'employment_verification',
        documentType: 'employment_contract',
        status: 'verified',
        userType: 'staff',
        userId: staffUser._id,
        departmentId: staffUser.departmentId,
        viewableByRoles: ['staff', 'admin'],
        metadata: { size: 2048, mimeType: 'application/pdf' }
      });
    });

    test('Guest can access their own documents', async () => {
      const response = await request(app)
        .get(`/api/v1/documents/${guestDocument._id}/metadata`)
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(response.body.document._id).toBe(guestDocument._id.toString());
    });

    test('Guest cannot access staff documents', async () => {
      await request(app)
        .get(`/api/v1/documents/${staffDocument._id}/metadata`)
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(403);
    });

    test('Staff can access their department documents', async () => {
      const response = await request(app)
        .get(`/api/v1/documents/${staffDocument._id}/metadata`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.document._id).toBe(staffDocument._id.toString());
    });

    test('Staff cannot access guest documents', async () => {
      await request(app)
        .get(`/api/v1/documents/${guestDocument._id}/metadata`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });

    test('Admin can access all documents', async () => {
      // Test guest document access
      const guestResponse = await request(app)
        .get(`/api/v1/documents/${guestDocument._id}/metadata`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(guestResponse.body.document._id).toBe(guestDocument._id.toString());

      // Test staff document access
      const staffResponse = await request(app)
        .get(`/api/v1/documents/${staffDocument._id}/metadata`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(staffResponse.body.document._id).toBe(staffDocument._id.toString());
    });
  });

  describe('Document Expiry and Renewal Workflow', () => {
    test('System identifies expiring documents', async () => {
      // Create documents with different expiry dates
      const expiringDoc = await Document.create({
        originalName: 'expiring-passport.pdf',
        fileName: 'expiring-passport.pdf',
        filePath: '/uploads/guest/expiring-passport.pdf',
        category: 'identity_proof',
        documentType: 'passport',
        status: 'verified',
        userType: 'guest',
        userId: guestUser._id,
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Expires in 7 days
        metadata: { size: 1024, mimeType: 'application/pdf' }
      });

      const response = await request(app)
        .get('/api/v1/documents/analytics?period=30d&userType=all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.analytics.expiringSoon).toBeDefined();
      expect(response.body.analytics.expiringSoon.length).toBeGreaterThan(0);
      expect(response.body.analytics.expiringSoon[0].daysUntilExpiry).toBeLessThanOrEqual(30);
    });

    test('System automatically marks expired documents', async () => {
      // Create an expired document
      const expiredDoc = await Document.create({
        originalName: 'expired-passport.pdf',
        fileName: 'expired-passport.pdf',
        filePath: '/uploads/guest/expired-passport.pdf',
        category: 'identity_proof',
        documentType: 'passport',
        status: 'verified',
        userType: 'guest',
        userId: guestUser._id,
        verifiedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired yesterday
        metadata: { size: 1024, mimeType: 'application/pdf' }
      });

      // Simulate the expiry check job
      const response = await request(app)
        .post('/api/v1/documents/admin/check-expiry')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Check that the document status was updated
      const updatedDoc = await Document.findById(expiredDoc._id);
      expect(updatedDoc.status).toBe('expired');
    });
  });

  describe('Audit Trail and Logging', () => {
    test('Document upload creates audit log entry', async () => {
      const response = await request(app)
        .post('/api/v1/documents/upload')
        .set('Authorization', `Bearer ${guestToken}`)
        .field('category', 'identity_proof')
        .field('documentType', 'passport')
        .field('userType', 'guest')
        .attach('document', Buffer.from('fake-pdf-content'), 'test-passport.pdf')
        .expect(201);

      const document = await Document.findById(response.body.document._id);
      expect(document.auditLog).toHaveLength(1);
      expect(document.auditLog[0].action).toBe('uploaded');
      expect(document.auditLog[0].performedBy.toString()).toBe(guestUser._id.toString());
    });

    test('Document verification creates audit log entry', async () => {
      const doc = await Document.create({
        originalName: 'test-passport.pdf',
        fileName: 'test-passport.pdf',
        filePath: '/uploads/guest/test-passport.pdf',
        category: 'identity_proof',
        documentType: 'passport',
        status: 'pending',
        userType: 'guest',
        userId: guestUser._id,
        metadata: { size: 1024, mimeType: 'application/pdf' },
        auditLog: [{
          action: 'uploaded',
          performedBy: guestUser._id,
          timestamp: new Date()
        }]
      });

      await request(app)
        .post(`/api/v1/documents/${doc._id}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Verified' })
        .expect(200);

      const updatedDoc = await Document.findById(doc._id);
      expect(updatedDoc.auditLog).toHaveLength(2);
      expect(updatedDoc.auditLog[1].action).toBe('verified');
      expect(updatedDoc.auditLog[1].performedBy.toString()).toBe(adminUser._id.toString());
    });
  });

  describe('Performance and Scalability', () => {
    test('Bulk document upload handles multiple files', async () => {
      const files = [
        { name: 'passport1.pdf', content: Buffer.from('fake-pdf-1') },
        { name: 'passport2.pdf', content: Buffer.from('fake-pdf-2') },
        { name: 'passport3.pdf', content: Buffer.from('fake-pdf-3') }
      ];

      const uploadPromises = files.map(file =>
        request(app)
          .post('/api/v1/documents/upload')
          .set('Authorization', `Bearer ${guestToken}`)
          .field('category', 'identity_proof')
          .field('documentType', 'passport')
          .field('userType', 'guest')
          .attach('document', file.content, file.name)
      );

      const responses = await Promise.all(uploadPromises);

      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Verify all documents were created
      const documents = await Document.find({ userId: guestUser._id });
      expect(documents).toHaveLength(3);
    });

    test('Document search and filtering performs efficiently', async () => {
      // Create multiple documents for search testing
      const documents = Array.from({ length: 10 }, (_, i) => ({
        originalName: `document-${i}.pdf`,
        fileName: `document-${i}.pdf`,
        filePath: `/uploads/guest/document-${i}.pdf`,
        category: i % 2 === 0 ? 'identity_proof' : 'visa',
        documentType: i % 2 === 0 ? 'passport' : 'tourist_visa',
        status: i % 3 === 0 ? 'pending' : 'verified',
        userType: 'guest',
        userId: guestUser._id,
        metadata: { size: 1024 + i, mimeType: 'application/pdf' }
      }));

      await Document.insertMany(documents);

      const startTime = Date.now();

      const response = await request(app)
        .get('/api/v1/documents/admin/queue?userType=guest&status=verified&category=identity_proof')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Should respond within 1 second for small dataset
      expect(responseTime).toBeLessThan(1000);

      // Should return filtered results
      expect(response.body.documents.length).toBeGreaterThan(0);
      response.body.documents.forEach(doc => {
        expect(doc.userType).toBe('guest');
        expect(doc.status).toBe('verified');
        expect(doc.category).toBe('identity_proof');
      });
    });
  });
});

console.log('Document Verification Workflow Tests Created Successfully');
console.log('Run with: npm test test-document-verification-workflow.js');