import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://localhost:8000/select_directory');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || '选择文件夹失败');
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '选择文件夹失败' },
      { status: 500 }
    );
  }
} 