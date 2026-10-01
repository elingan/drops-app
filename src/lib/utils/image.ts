/** Downscales a picked photo to a compact JPEG blob (max side 640px). */
export async function compressImage(file: File, max = 640): Promise<Blob> {
	if (!file.type.startsWith('image/') || file.size > 25 * 1024 * 1024) throw new Error('invalid_image');
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	return new Promise((resolve, reject) =>
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('invalid_image'))), 'image/jpeg', 0.82)
	);
}
