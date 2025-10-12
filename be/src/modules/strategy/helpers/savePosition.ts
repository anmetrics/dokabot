import * as fs from 'fs';
import * as path from 'path';

// Lưu file positions relative với root project
const FILE_PATH = path.resolve(process.cwd(), 'src/positions.json');

export const loadPositions = (): any[] => {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      // Tạo folder nếu chưa tồn tại
      fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
      fs.writeFileSync(FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load positions, creating new one', err);
    return [];
  }
};

export const savePositions = (positions: any[]) => {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(positions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save positions', err);
  }
};
