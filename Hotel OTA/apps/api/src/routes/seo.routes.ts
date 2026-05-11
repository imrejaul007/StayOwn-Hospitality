import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateAdmin } from '../middleware/auth';
import { prisma } from '../config/database';
import { Errors } from '../utils/errors';

const router = Router();

// Public SEO pages
router.get('/page/:slug', asyncHandler(async (req: Request, res: Response) => {
  const page = await prisma.seoLandingPage.findUnique({ where: { slug: req.params.slug } });
  if (!page || !page.isPublished) throw Errors.notFound('Page');

  // If hotel-specific, include hotel data
  let hotel: any = null;
  if (page.hotelId) {
    hotel = await prisma.hotel.findUnique({
      where: { id: page.hotelId },
      include: { roomTypes: { where: { isActive: true } } },
    });
  }

  res.json({ page, hotel });
}));

// Admin CRUD
router.post('/pages', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { slug, hotel_id, city, category, title, meta_desc, h1, body_html } = req.body;
  if (!slug || !title) throw Errors.validation('slug and title required');

  const page = await prisma.seoLandingPage.create({
    data: { slug, hotelId: hotel_id, city, category, title, metaDesc: meta_desc, h1, bodyHtml: body_html },
  });
  res.status(201).json(page);
}));

router.put('/pages/:id', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { title, meta_desc, h1, body_html, is_published } = req.body;
  const page = await prisma.seoLandingPage.update({
    where: { id: req.params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(meta_desc !== undefined && { metaDesc: meta_desc }),
      ...(h1 !== undefined && { h1 }),
      ...(body_html !== undefined && { bodyHtml: body_html }),
      ...(is_published !== undefined && { isPublished: is_published }),
    },
  });
  res.json(page);
}));

router.get('/pages', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const pages = await prisma.seoLandingPage.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ pages });
}));

// Cities
router.get('/cities', asyncHandler(async (_req: Request, res: Response) => {
  const cities = await prisma.city.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  res.json({ cities });
}));

router.get('/cities/all', authenticateAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const cities = await prisma.city.findMany({ orderBy: { name: 'asc' } });
  res.json({ cities });
}));

export default router;
