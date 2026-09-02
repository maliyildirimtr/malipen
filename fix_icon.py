import os
from PIL import Image, ImageDraw

def create_circular_icon(input_path, output_dir):
    img = Image.open(input_path).convert("RGBA")
    # Crop the black borders (magic numbers based on the analysis of the user's specific 1024x1024 image)
    img = img.crop((58, 60, 966, 968)) # 908x908
    
    size = min(img.size)
    
    # Create antialiased mask
    scale = 4
    mask_size = size * scale
    mask = Image.new('L', (mask_size, mask_size), 0)
    draw = ImageDraw.Draw(mask)
    
    # Standard squircle radius is around 22.5% of the width
    radius = int(mask_size * 0.225)
    draw.rounded_rectangle((0, 0, mask_size, mask_size), radius=radius, fill=255)
    mask = mask.resize((size, size), Image.Resampling.LANCZOS)
    
    img.putalpha(mask)
    
    # Save a test file to verify
    img.save(os.path.join(output_dir, "favicon-512x512.png"), "PNG")
    
create_circular_icon("/Users/maliy_00/.gemini/antigravity-ide/brain/1ab7c21f-0b54-49ac-9aeb-2f52032f9a17/.user_uploaded/media_1788277344707.jpg", "/Users/maliy_00/Documents/MaliPen/website/assets")
