import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename');

  if (!filename) {
    return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
  }

  try {
    const response = await fetch(`http://localhost:8000/progress/${filename}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Failed to fetch progress');
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch progress' },
      { status: 500 }
    );
  }
} 