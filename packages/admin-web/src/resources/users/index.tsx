import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  EmailField,
  DateField,
  Show,
  SimpleShowLayout,
  EditButton,
  ShowButton,
  FilterList,
  FilterListItem,
  TextInput,
} from 'react-admin';
import { Card, CardContent } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PersonIcon from '@mui/icons-material/Person';

export const UserList = () => (
  <List
    filters={[
      <TextInput source="search" label="搜索" alwaysOn />,
    ]}
  >
    <Datagrid rowClick="show">
      <TextField source="id" label="ID" />
      <TextField source="nickname" label="昵称" />
      <EmailField source="email" label="邮箱" />
      <TextField source="subscription_tier" label="会员等级" />
      <TextField source="is_active" label="状态" />
      <DateField source="created_at" label="注册时间" showTime />
      <ShowButton />
      <EditButton />
    </Datagrid>
  </List>
);

export const UserShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="nickname" label="昵称" />
      <EmailField source="email" label="邮箱" />
      <TextField source="subscription_tier" label="会员等级" />
      <TextField source="is_active" label="状态" />
      <DateField source="created_at" label="注册时间" showTime />
      <TextField source="token_balance" label="Token余额" />
      <TextField source="points_balance" label="积分余额" />
    </SimpleShowLayout>
  </Show>
);

export const UserFilters = () => (
  <Card>
    <CardContent>
      <FilterList label="用户状态" icon={<PeopleIcon />}>
        <FilterListItem label="活跃用户" value={{ is_active: true }} />
        <FilterListItem label="已禁用" value={{ is_active: false }} />
      </FilterList>
      <FilterList label="会员等级" icon={<PersonIcon />}>
        <FilterListItem label="免费用户" value={{ subscription_tier: 'free' }} />
        <FilterListItem label="高级会员" value={{ subscription_tier: 'premium' }} />
        <FilterListItem label="企业会员" value={{ subscription_tier: 'enterprise' }} />
      </FilterList>
    </CardContent>
  </Card>
);