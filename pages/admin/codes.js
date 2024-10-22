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
 } from '@mui/material';
 import {
  callLookupCodes,
  callGenerateCode,
} from '@src/client/codes';
import { PrettyDate } from '@src/common/date';
import { defaultGetServerSideProps } from '@src/client/prerender';
import { CopyToClipboardIconButton } from '@src/client/components/standard/copytoclipboardiconbutton';
import { Cloud } from '@mui/icons-material';



export default function Home(props) {
  const { Constants } = useConfig();
  const router = useRouter();
  const { loading, account, hasServicePerms } = React.useContext(stateManager);
  const [codes, setCodes] = useState([]);
  const [newCodePurpose, setNewCodePurpose] = useState('Creator access');
  const [newCodeNotes, setNewCodeNotes] = useState('');

  async function refreshCodes() {
    const codes = await callLookupCodes(true);
    setCodes(codes ? codes : []);
  }

  useEffect(() => {
    if (!loading && !hasServicePerms("service_modifyGlobalPermissions")) {
      console.log("Not an admin");
      router.replace('/');
    } else if (!loading && account) {
      console.log("Loading codes");
      refreshCodes();
    }

    // TODO: Load existing codes from your backend or state management
  }, [loading, account]);

  async function handleCreateCode() {
    const code = await callGenerateCode("access", newCodeNotes, null, null);
    refreshCodes();
    // Reset form fields
    setNewCodePurpose('');
    setNewCodeNotes('');
  };

  return (
    <RequireAuthentication>
      <DefaultLayout title={"Invite Access Codes (ADMIN)"}>
        <StandardContentArea>
          {/* Code Creation Form */}
          <Box component="form" sx={{ mb: 4 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="code-purpose-label">Purpose</InputLabel>
              <Select
                labelId="code-purpose-label"
                id="code-purpose"
                value={newCodePurpose}
                label="Purpose"
                onChange={(e) => setNewCodePurpose(e.target.value)}
              >
                <MenuItem value="Creator access">Creator access</MenuItem>
              </Select>
            </FormControl>
            <TextField
              id="code-notes"
              label="Notes"
              multiline
              rows={4}
              value={newCodeNotes}
              onChange={(e) => setNewCodeNotes(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
            />
            <Button variant="contained" onClick={handleCreateCode}>Create Code</Button>
          </Box>

          {/* Codes Table */}
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell>Redeemed</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Redemption Date</TableCell>
                  <TableCell>Purpose</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {codes.map((code, index) => (
                  <TableRow key={index}>
                    <TableCell>{code.code}  <CopyToClipboardIconButton 
                        textToCopy={"https://playday.ai/account/redeemkey?code=" + code.code} 
                        icon={<Cloud />}
                    /></TableCell>
                    <TableCell>{code.notes}</TableCell>
                    <TableCell>{code.redeemed ? '✅' : ''}</TableCell>
                    <TableCell>{PrettyDate(code.creationDate)}</TableCell>
                    <TableCell>{PrettyDate(code.redemptionDate)}</TableCell>
                    <TableCell>{code.grants}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </StandardContentArea>
      </DefaultLayout>
    </RequireAuthentication>
  );
}


export const getServerSideProps = defaultGetServerSideProps;