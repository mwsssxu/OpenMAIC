import React from 'react';
import { Layout } from 'react-admin';
import { Box } from '@mui/material';

const CustomLayout = ({ children }) => (
  <Layout>
    <Box sx={{ p: 2 }}>
      {children}
    </Box>
  </Layout>
);

export default CustomLayout;