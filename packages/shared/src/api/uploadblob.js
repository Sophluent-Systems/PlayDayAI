import { withApiAuthRequired } from '@src/backend/authWithToken';
import { doAuthAndValidation } from '@src/backend/validation';
import { addBlobToStorage } from '@src/backend/blobstorage';

const handler = withApiAuthRequired(async (req, res) => {
  const { validationError, db, account, Constants } = await doAuthAndValidation(
    'POST',
    req,
    res,
    ['service_modifyGlobalPermissions', 'service_editMode']
  );

  if (validationError) {
    res.status(validationError.status).json({ error: { message: validationError.message } });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: { message: 'No file uploaded' } });
    return;
  }

  const { mimetype: mimeType, buffer, originalname } = req.file;

  if (!Constants.supportedMimeTypes.includes(mimeType)) {
    res.status(400).json({ error: { message: `Invalid parameter -- unsupported MIME type: ${mimeType}` } });
    return;
  }

  try {
    const fileType = originalname.split('.').pop().toLowerCase();

    const blobID = await addBlobToStorage(
      db,
      buffer.toString('base64'),
      fileType,
      mimeType,
      account.accountID,
      null
    );

    res.status(200).json({
      blobID,
      mimeType,
      data: blobID,
      source: 'storage',
    });
  } catch (error) {
    res.status(500).json({
      error: {
        message: 'An error occurred during file upload.',
      },
    });
  }
});

export default handler;
