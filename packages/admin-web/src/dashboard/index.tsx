import React from 'react';
import { Card, CardContent, Typography, Grid, Box } from '@mui/material';
import { useGetList, Title } from 'react-admin';
import PeopleIcon from '@mui/icons-material/People';
import SchoolIcon from '@mui/icons-material/School';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TokenIcon from '@mui/icons-material/Token';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}

const StatsCard = ({ title, value, subtitle, icon, color }: StatsCardProps) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" alignItems="center" mb={1}>
        <Box
          sx={{
            bgcolor: color,
            borderRadius: '50%',
            p: 1,
            mr: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
        <Typography variant="h6" component="div">
          {title}
        </Typography>
      </Box>
      <Typography variant="h4" component="div" fontWeight="bold">
        {value}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      )}
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const { data: userStats, isLoading: usersLoading, total: userTotal } = useGetList('users', {
    pagination: { page: 1, perPage: 1 },
  });
  const { data: courseStats, isLoading: coursesLoading, total: courseTotal } = useGetList('courses', {
    pagination: { page: 1, perPage: 1 },
  });

  return (
    <Box sx={{ p: 3 }}>
      <Title title="管理后台" />
      <Typography variant="h4" sx={{ mb: 3 }}>
        数据概览
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="用户总数"
            value={usersLoading ? '...' : userTotal || 0}
            subtitle="平台注册用户"
            icon={<PeopleIcon sx={{ color: 'white' }} />}
            color="#2196F3"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="课程总数"
            value={coursesLoading ? '...' : courseTotal || 0}
            subtitle="已生成课程"
            icon={<SchoolIcon sx={{ color: 'white' }} />}
            color="#4CAF50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="今日收入"
            value="¥0"
            subtitle="Token采购"
            icon={<TrendingUpIcon sx={{ color: 'white' }} />}
            color="#FF9800"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            title="今日活跃"
            value="0"
            subtitle="活跃用户数"
            icon={<TokenIcon sx={{ color: 'white' }} />}
            color="#9C27B0"
          />
        </Grid>
      </Grid>

      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
        快捷操作
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="h6">用户管理</Typography>
              <Typography variant="body2" color="text.secondary">
                查看和管理平台用户
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="h6">课程管理</Typography>
              <Typography variant="body2" color="text.secondary">
                查看和管理生成课程
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;