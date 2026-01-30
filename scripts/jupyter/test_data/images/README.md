# Test Images Directory

This directory contains test images for the AI Service vision analysis pipeline.

## Adding Test Images

Place pet images (dogs or cats) in this directory to test the multi-stage vision pipeline.

**Supported formats:**
- JPG / JPEG
- PNG
- WEBP
- BMP

**Recommended image specifications:**
- Resolution: 512x512 or larger
- File size: < 5 MB
- Content: Clear, well-lit photos of dogs or cats
- Quality: High resolution, minimal blur

## Examples

```bash
# Copy images from your local filesystem
cp ~/Pictures/my_dog.jpg ./
cp ~/Pictures/my_cat.png ./

# Download sample images (if you have URLs)
wget -O golden_retriever.jpg "https://example.com/dog.jpg"
curl -o persian_cat.png "https://example.com/cat.png"
```

## Testing Different Scenarios

For comprehensive testing, include:
- ✅ **Purebred dogs** (Golden Retriever, German Shepherd, etc.)
- ✅ **Purebred cats** (Persian, Siamese, Maine Coon, etc.)
- ✅ **Crossbreed/mixed dogs** (Goldendoodle, Labradoodle, mutts)
- ✅ **Various angles** (profile, front-facing, action shots)
- ✅ **Different lighting** (indoor, outdoor, natural light)
- ✅ **Multiple sizes** (puppies/kittens, adults, seniors)

## Edge Cases to Test

Consider adding images for:
- Blurry or low-quality photos
- Multiple pets in one image
- Partial views (only head visible)
- Unusual angles or perspectives
- Different coat colors/patterns

## Usage

Once you've added images, run the Jupyter notebook:
```bash
cd /home/crea/Desktop/ft_transcendence/scripts/jupyter
jupyter notebook test_ai_service.ipynb
```

The notebook will:
1. Automatically discover all images in this directory
2. Display available images with file sizes
3. Allow you to select which image to analyze
4. Support batch testing of all images

## Current Images

Run the notebook to see a list of currently available test images.
