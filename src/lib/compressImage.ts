/**
 * Compresses an image File using a canvas, returning a base64 JPEG string.
 * - Max dimension: 1280px (keeps aspect ratio)
 * - Quality: 0.78 JPEG
 * Result is typically 5-15x smaller than the original PNG/uncompressed JPEG.
 */
export function compressImage(file: File, maxPx = 1280, quality = 0.78): Promise<string> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new window.Image();

        img.onload = () => {
            URL.revokeObjectURL(url);

            let { width, height } = img;
            if (width > maxPx || height > maxPx) {
                if (width >= height) {
                    height = Math.round((height / width) * maxPx);
                    width = maxPx;
                } else {
                    width = Math.round((width / height) * maxPx);
                    height = maxPx;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Falha ao carregar imagem'));
        };

        img.src = url;
    });
}
