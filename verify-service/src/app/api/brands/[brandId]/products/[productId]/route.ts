import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { requireBrandAccess } from '@/lib/auth'

const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  image: z.string().url().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { brandId: string; productId: string } }
) {
  try {
    const product = await prisma.product.findFirst({
      where: {
        id: params.productId,
        brandId: params.brandId,
      },
      include: {
        serials: {
          select: {
            id: true,
            serialNumber: true,
            status: true,
            scanCount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { serials: true },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Get product error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { brandId: string; productId: string } }
) {
  try {
    const auth = await requireBrandAccess(request, params.brandId)
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const data = updateProductSchema.parse(body)

    const product = await prisma.product.update({
      where: { id: params.productId },
      data,
    })

    return NextResponse.json({ product })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    console.error('Update product error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { brandId: string; productId: string } }
) {
  try {
    const auth = await requireBrandAccess(request, params.brandId)
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    await prisma.product.update({
      where: { id: params.productId },
      data: { status: 'ARCHIVED' },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete product error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
