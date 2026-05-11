import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/db'
import { requireBrandAccess } from '@/lib/auth'
import { generateSerials, generateQRCodeDataURL } from '@/lib/serial/generator'
import { generateQRCodeBuffer } from '@/lib/serial/qr'

const generateSerialsSchema = z.object({
  count: z.number().min(1).max(10000),
  batchName: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { brandId: string; productId: string } }
) {
  try {
    const auth = await requireBrandAccess(request, params.brandId)
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const body = await request.json()
    const data = generateSerialsSchema.parse(body)

    const product = await prisma.product.findFirst({
      where: { id: params.productId, brandId: params.brandId },
      include: { brand: true },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const serials = generateSerials(data.count, product.brand.secretKey, {
      batchName: data.batchName,
    })

    const createdSerials = await prisma.$transaction(
      serials.map((serial) =>
        prisma.serial.create({
          data: {
            productId: params.productId,
            serialNumber: serial.serialNumber,
            signature: serial.signature,
            batchId: serial.batchId,
            batchName: serial.batchName,
            status: 'ACTIVE',
          },
        })
      )
    )

    await prisma.product.update({
      where: { id: params.productId },
      data: { totalSerials: { increment: data.count } },
    })

    const serialsWithQR = await Promise.all(
      createdSerials.map(async (serial) => ({
        ...serial,
        qrCode: await generateQRCodeDataURL(serial.serialNumber, serial.signature),
      }))
    )

    return NextResponse.json({
      serials: serialsWithQR,
      batchId: serials[0]?.batchId,
      batchName: data.batchName,
      count: createdSerials.length,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 })
    }
    console.error('Generate serials error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { brandId: string; productId: string } }
) {
  try {
    const auth = await requireBrandAccess(request, params.brandId)
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const batchId = searchParams.get('batchId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = { productId: params.productId }
    if (status) where.status = status
    if (batchId) where.batchId = batchId

    const [serials, total] = await Promise.all([
      prisma.serial.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.serial.count({ where }),
    ])

    return NextResponse.json({ serials, total, limit, offset })
  } catch (error) {
    console.error('Get serials error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
