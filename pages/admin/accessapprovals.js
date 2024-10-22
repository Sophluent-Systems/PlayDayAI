import React, { useState, useEffect } from 'react';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { stateManager } from '@src/client/statemanager';
import { useRouter } from 'next/router';
import { useConfig } from '@src/client/configprovider';
import { 
  Button,
  TextField, 
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Box,
  Typography,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  DialogContentText,
 } from '@mui/material';
import { PrettyDate } from '@src/common/date';
import { getEmailTemplate, setEmailTemplate } from '@src/client/adminemail';
import {
  callDenyCodeRequest,
 callGenerateCode,
} from '@src/client/codes';
import { callGetAccessRequests } from '@src/client/codes';
import { defaultGetServerSideProps } from '@src/client/prerender';
import { CopyToClipboardIconButton } from '@src/client/components/standard/copytoclipboardiconbutton';
import { Cloud } from '@mui/icons-material';
import dynamic from 'next/dynamic';
import { sendAdminEmail } from '@src/client/adminemail';
import { nullUndefinedOrEmpty } from '@src/common/objects';

// Import React Quill only on client-side
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });
import 'react-quill/dist/quill.snow.css'; // import styles for React Quill
import { set } from 'lodash';

// Quill modules to include
const modules = {
    toolbar: [
        [{ 'header': '1'}, {'header': '2'}, { 'font': [] }],
        [{size: []}],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{'list': 'ordered'}, {'list': 'bullet'}, 
         {'indent': '-1'}, {'indent': '+1'}],
        ['link', 'image'],
        ['clean']
    ],
    clipboard: {
        // Toggle to add extra line breaks when pasting HTML:
        matchVisual: false,
    }
};

// Formats objects for React Quill
const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image'
];

const defaultSubject = "Your invitation to PlayDay.ai";
const defaultText = "Welcome to PlayDa.aiy!\r\n\r\nWe're excited to see the AI creations you'll make.  Here is your access code:\r\n\r\n${codeUri}\r\n\r\nPlease let us know if you have any questions or need help with anything. Have a great day!\r\n\r\n- The PlayDay.ai team";
const defaultHtml = "Welcome to PlayDay.ai!<br>We're excited to see the AI creations you'll make.  Here is your access code:<br><br>${codeUri}<br>brPlease let us know if you have any questions or need help with anything. Have a great day!<br><br>- The PlayDay.ai team";

export default function Home(props) {
  const { Constants } = useConfig();
  const router = useRouter();
  const { loading, account, hasServicePerms } = React.useContext(stateManager);
  const [subject, setSubject] = useState(null);
  const [textContent, setTextContent] = useState(null);
  const [htmlContent, setHtmlContent] = useState(null);
  const [templateLocal, setTemplateLocal] = useState(null);
  const [accessRequests, setAccessRequests] = useState([]);
  const [filter, setFilter] = useState('requested');
  const [notes, setNotes] = useState({});
  const [confirmApproveDialogOpen, setConfirmApproveDialogOpen] = useState(false);

  // Fetch template on mount
  useEffect(() => {
      const fetchTemplate = async () => {
          try {
              let newTemplate = await getEmailTemplate('welcomeemail');
              if (!newTemplate) {
                  newTemplate = {}
              };
              let changed = false;
              if (nullUndefinedOrEmpty(newTemplate?.subject)) {
                  newTemplate.subject = defaultSubject;
                  changed = true;
              }
              if (nullUndefinedOrEmpty(newTemplate?.text)) {
                  newTemplate.text = defaultText;
                  changed = true;
              }
              if (nullUndefinedOrEmpty(newTemplate?.html)) {
                  newTemplate.html = defaultHtml;
                  changed = true;
              }
              if (changed) {
                  await setEmailTemplate('welcomeemail', newTemplate);
              }
              console.log("Loaded email template:", newTemplate);
              setTemplateLocal(newTemplate);
              setSubject(newTemplate.subject);
              setTextContent(newTemplate.text);
              setHtmlContent(newTemplate.html);
          } catch (error) {
              console.error("Failed to load email template:", error);
          }
      };


      fetchTemplate();
  }, []);

  useEffect(() => {

    const fetchAccessRequests = async () => {
      try {
        const requests = await callGetAccessRequests(filter == 'all' ? null : filter);
        setAccessRequests(requests);
      } catch (error) {
        console.error("Failed to load access requests:", error);
      }
    }

    fetchAccessRequests();
  }, [filter]);
  
    // Update template on content change
    useEffect(() => {
      const updateTemplate = async () => {
          try {
              await setEmailTemplate('welcomeemail', { subject, text: textContent, html: htmlContent});
              setTemplateLocal({ subject, text: textContent, html: htmlContent});
          } catch (error) {
              console.error("Failed to update email template:", error);
          }
      };

      if (templateLocal !== null && (subject !== templateLocal.subject || textContent !== templateLocal.text || htmlContent !== templateLocal.html)) {
        updateTemplate();
      }
  }, [textContent, htmlContent, subject]);

  useEffect(() => {
    if (!loading && !hasServicePerms("service_modifyGlobalPermissions")) {
      console.log("Not an admin");
      router.replace('/');
    } else if (!loading && account) {
      console.log("Loading codes");
    }

    // TODO: Load existing codes from your backend or state management
  }, [loading, account]);

  async function approveRequest(requestIndex) {
    const request = accessRequests[requestIndex];
    const newCodeNotes = request.email + (notes[request.email] ? ": " + notes[request.email] : "");
    const code = await callGenerateCode("access", newCodeNotes, request.accountID, null);
    console.log("CODE: ", code.code)
    setAccessRequests((requests) => {
      const newRequests = [...requests];
      newRequests[requestIndex].preferences.accessRequestStatus = "approved";
      newRequests[requestIndex].accessCode = code.code;
      return newRequests;
    });

    const uri = "https://playday.ai/account/redeemkey?code=" + code.code;
    let emailOptions= {to: request.email, subject: subject, text: textContent.replace("${codeUri}", uri), html: htmlContent.replace("${codeUri}", `<a href="${uri}">${code.code}</a>`) }
    sendAdminEmail(emailOptions);
  }

  function stripHtml(html) {
    let plaintext = html.replace("<br>", "\r\n");
    plaintext = plaintext.replace("<p>", "\r\n\r\n");
    // if the html starts with "\r\n", remove it
    while (plaintext.startsWith("\r\n")) {
      plaintext = plaintext.substring(2);
    }
    return plaintext.replace(/<[^>]*>?/gm, '');
}

  const updateEmailContent = (newText) => {

    setHtmlContent(newText);

    const plaintext = stripHtml(newText)
    if (nullUndefinedOrEmpty(plaintext) || plaintext.length == 0) {
      throw new Error("Plaintext content was empty!");
    }
    setTextContent(plaintext);
  };

  async function denyRequest(requestIndex) {
    const request = accessRequests[requestIndex];
    await callDenyCodeRequest(request.accountID);
    setAccessRequests((requests) => {
      const newRequests = [...requests];
      newRequests[requestIndex].preferences.accessRequestStatus = "denied";
      return newRequests;
    });
  };

  const approveAll = () => {
    accessRequests.forEach((request, index) => {
      if (request.preferences.accessRequestStatus != "approved") {
        approveRequest(index);
      }
    });
  };

  const denyAll = () => {
    accessRequests.forEach((request, index) => {
      if (request.preferences.accessRequestStatus == "requested") {
        denyRequest(index);
      }
    });
  };


  if (subject === null || textContent === null || htmlContent === null) {
      return <DefaultLayout title={"Loading..."}>
          <StandardContentArea>
              <Typography variant="h4">Loading...</Typography>
          </StandardContentArea>
      </DefaultLayout>;
  }

  return (
    <RequireAuthentication>
      <DefaultLayout title={"Access Request Approvals (ADMIN)"}>
        <StandardContentArea>
          <Box sx={{ display: 'flex', width: '100%', height: '100%', flexDirection: 'column' }}>
              {/* Welcome Email */}
              <Box component="form" sx={{ mb: 4 }}>
                <Box sx={{ maxWidth: 600, mx: 'auto', my: 4 }}>
                    <Typography variant="h6" gutterBottom>
                        Email Template Editor
                    </Typography>
                    <TextField
                        fullWidth
                        label="Subject"
                        variant="outlined"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        margin="normal"
                    />
                    <ReactQuill
                        theme="snow"
                        value={htmlContent}
                        onChange={(newText) => updateEmailContent(newText)}
                        modules={modules}
                        formats={formats}
                        bounds={'.app'}
                        placeholder="Compose email..."
                        style={{ height: '400px', border: '1px solid black' }}
                    />
                </Box>
              </Box>

              {/*Dropdown to modify the filter */}
              <FormControl sx={{
                minWidth: 120,
                margin: 2,
              }}>
                <InputLabel id="filter-label">Filter</InputLabel>
                <Select
                  labelId="filter-label"
                  id="filter"
                  value={filter}
                  label="Filter"
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <MenuItem value={"requested"}>Requested</MenuItem>
                  <MenuItem value={"approved"}>Approved</MenuItem>
                  <MenuItem value={"denied"}>Denied</MenuItem>
                  <MenuItem value={"all"}>All</MenuItem>
                </Select>
              </FormControl>
              
              <Box 
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  margin: 2,
                }}
                >

                <Button
                  variant="contained"
                  onClick={() => setConfirmApproveDialogOpen(true)}
                  sx={{ml:1, mr:1}}
                >
                  Approve All
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  onClick={() => denyAll()}
                  sx={{ml:1, mr:1}}
                >
                  Deny All
                </Button>
                </Box>

              {/* Codes Table */}
              <TableContainer component={Paper}>
                <Table sx={{ minWidth: 650 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Request Status</TableCell>
                      <TableCell>Request Date</TableCell>
                      <TableCell>Approve</TableCell>
                      <TableCell>Approval Notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {accessRequests.map((account, index) => (
                      <TableRow key={index}>
                        <TableCell>{account.email}</TableCell>
                        <TableCell>{account.preferences.accessRequestStatus}</TableCell>
                        <TableCell>{account.preferences.accessRequestDate ? PrettyDate(account.preferences.accessRequestDate) : '' }</TableCell>
                        <TableCell>{account.preferences.accessRequestStatus == "approved" ? (
                            <CopyToClipboardIconButton 
                            textToCopy={"https://playday.ai/account/redeemkey?code=" + account.accessCode} 
                            icon={<Cloud />}
                            />
                        ) : account.preferences.accessRequestStatus == "denied" ? (
                          <Button
                            variant="contained"
                            onClick={() => approveRequest(index)}
                            sx={{ml:1, mr:1}}
                          >
                            Approve
                          </Button>
                        ) : (
                          <Box>
                            <Button
                              variant="contained"
                              onClick={() => approveRequest(index)}
                              sx={{ml:1, mr:1}}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="contained"
                              color="error"
                              onClick={() => denyRequest(index)}
                              sx={{ml:1, mr:1}}
                            >
                              Deny
                            </Button>
                          </Box>
                         )}</TableCell>
                        <TableCell>{account.preferences.accessRequestStatus != "approved" ? (
                          <TextField
                            label="Notes"
                            value={notes[account.email] || ''}
                            onChange={(e) => setNotes((notes) => {
                              const newNotes = { ...notes };
                              newNotes[account.email] = e.target.value;
                              return newNotes;
                            })}
                          />
                        ) : null }</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer> 
          </Box>

          <Dialog open={confirmApproveDialogOpen} onClose={() => setConfirmApproveDialogOpen(false)}>
              <DialogTitle>Confirm?</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  Are you sure you want to approve all access requests? THIS WILL EMAIL EVERY PERSON ON THE LIST.
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setConfirmApproveDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => approveAll()}>
                  Approve All
                </Button>
              </DialogActions>
          </Dialog>
        </StandardContentArea>
      </DefaultLayout>
    </RequireAuthentication>
  );
}


export const getServerSideProps = defaultGetServerSideProps;