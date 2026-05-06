import pytesseract
import pdf2image
from PIL import Image
class OCRModule:
    def __init__(self):
        pass

    def extract_text(self, image_path):
        # Load the image using PIL
        image = Image.open(image_path)
        
        # Use pytesseract to extract text from the image
        text = pytesseract.image_to_string(image, lang='vie')
        
        return text

    def extract_text_from_image_array(self, image_array):
        # Convert the numpy array to a PIL Image
        image = Image.fromarray(image_array)
        
        # Use pytesseract to extract text from the image
        text = pytesseract.image_to_string(image, lang='vie')
        
        return text
    def extract_text_from_pdf(self, pdf_path):
        # Convert PDF to images
        images = pdf2image.convert_from_path(pdf_path)
        
        # Extract text from each image
        text = ""
        for image in images:
            text += pytesseract.image_to_string(image, lang='vie') + "\n"
        
        return text
# Example usage:
# ocr = OCRModule()
# text = ocr.extract_text('path_to_image.jpg')
# print(text)
# Example usage with a numpy array:
# image_array = np.array(Image.open('path_to_image.jpg'))
# text = ocr.extract_text_from_image_array(image_array)
# print(text)
# Example usage with a PDF:
# text = ocr.extract_text_from_pdf('sample_pdf.pdf')
# print(text)