// pages/api/uploadblob.js
import { withApiAuthRequired } from '@src/backend/auth';
import { doAuthAndValidation } from '@src/backend/validation';
import { addBlobToStorage } from '@src/backend/blobstorage';
import multer from 'multer';
import { createRouter } from "next-connect";

export const config = {
  api: {
    bodyParser: false,
  },
};


const router = createRouter();

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 16000000, // 16 MB
  },
});

const uploadMiddleware = upload.single('file');

router.use(uploadMiddleware);

router.post(withApiAuthRequired(async (req, res) => {
  console.error("Received request body:", req.body);
  console.error("Received file:", req.file);

  const { validationError, db, user, acl, account, Constants } = await doAuthAndValidation('POST', req, res, ["service_modifyGlobalPermissions", "service_editMode"]);

  if (validationError) {
    console.error("Validation error:", validationError);
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }

  if (!req.file) {
    console.error("No file uploaded");
    res.status(400).json({ error: { message: 'No file uploaded' } });
    return;
  }

  const { mimetype: mimeType, buffer, originalname } = req.file;

  if (!Constants.supportedMimeTypes.includes(mimeType)) {
    console.error(`uploadblob: Invalid parameters -- unsupported MIME type: ${mimeType}`);
    res.status(400).json({ error: { message: `Invalid parameter -- unsupported MIME type: ${mimeType}` } });
    return;
  }


  try {
    // Get file type from the original filename
    const fileType = originalname.split('.').pop().toLowerCase();
    
    // Save the blob
    const blobID = await addBlobToStorage(
      db, 
      buffer.toString('base64'),
      fileType, 
      mimeType, 
      account.accountID, 
      null
    );
    
    res.status(200).json({ 
      blobID: blobID,
      mimeType: mimeType,
      data: blobID,
      source: 'storage'
    });
  } catch (error) {
    console.error(`Error uploading blob: ${error.message}`);
    res.status(500).json({
      error: {
        message: 'An error occurred during file upload.',
      }
    });
  }
}));

export default router.handler({
  onError: (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).end("Server Error: "+ err.message);
  },
  onNoMatch: (req, res) => {
    res.status(404).end("Not found");
  },
});