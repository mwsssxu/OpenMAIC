import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ detail: 'No file provided' }, { status: 400 });
  }

  // 转发到后端
  const backendFormData = new FormData();
  backendFormData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/media/upload`, {
    method: 'POST',
    body: backendFormData,
  });

  const data = await response.json();

  return NextResponse.json(data, {
    status: response.status,
  });
}