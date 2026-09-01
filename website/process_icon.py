import os
from PIL import Image, ImageDraw

def create_circular_icon(input_path, output_dir):
    # Open image and convert to RGBA
    img = Image.open(input_path).convert("RGBA")
    
    # Ensure it's square
    size = min(img.size)
    left = (img.width - size) / 2
    top = (img.height - size) / 2
    right = (img.width + size) / 2
    bottom = (img.height + size) / 2
    img = img.crop((left, top, right, bottom))
    
    # Create antialiased mask
    # We draw at 4x scale then downsample for smooth edges
    scale = 4
    mask_size = size * scale
    mask = Image.new('L', (mask_size, mask_size), 0)
    draw = ImageDraw.Draw(mask)
    # Use rounded rectangle with radius 22% of the size
    radius = int(mask_size * 0.225)
    draw.rounded_rectangle((0, 0, mask_size, mask_size), radius=radius, fill=255)
    mask = mask.resize((size, size), Image.Resampling.LANCZOS)
    
    # Apply mask
    img.putalpha(mask)
    
    # Save base PNG
    base_png = os.path.join(output_dir, "icon.png")
    img.save(base_png, "PNG")
    
    # Define sizes
    sizes = {
        'favicon-16x16.png': 16,
        'favicon-32x32.png': 32,
        'apple-touch-icon.png': 180,
        'android-chrome-192x192.png': 192,
        'android-chrome-512x512.png': 512,
    }
    
    for filename, sz in sizes.items():
        resized = img.resize((sz, sz), Image.Resampling.LANCZOS)
        resized.save(os.path.join(output_dir, filename), "PNG")
        
    # Generate ICO file containing multiple sizes
    ico_path = os.path.join(output_dir, "favicon.ico")
    icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
    img.save(ico_path, format="ICO", sizes=icon_sizes)
    print("Icons generated successfully in", output_dir)

if __name__ == "__main__":
    input_file = "/Users/maliy_00/.gemini/antigravity-ide/brain/1ab7c21f-0b54-49ac-9aeb-2f52032f9a17/.user_uploaded/media_1788277344707.jpg"
    output_directory = "/Users/maliy_00/Documents/MaliPen/website/assets"
    
    # Make sure output directory exists
    os.makedirs(output_directory, exist_ok=True)
    
    create_circular_icon(input_file, output_directory)
