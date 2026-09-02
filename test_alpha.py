from PIL import Image

img = Image.open("/Users/maliy_00/Documents/MaliPen/website/assets/favicon-32x32.png")
transparent_pixels = 0
for y in range(img.height):
    for x in range(img.width):
        r,g,b,a = img.getpixel((x,y))
        if a < 255:
            transparent_pixels += 1

print(f"Total pixels: {img.width * img.height}")
print(f"Transparent/semi-transparent pixels: {transparent_pixels}")
