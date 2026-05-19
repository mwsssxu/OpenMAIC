import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  DateField,
  Show,
  SimpleShowLayout,
  ShowButton,
  TextInput,
  NumberField,
} from 'react-admin';

export const CourseList = () => (
  <List
    filters={[
      <TextInput source="search" label="搜索" alwaysOn />,
    ]}
  >
    <Datagrid rowClick="show">
      <TextField source="id" label="ID" />
      <TextField source="title" label="标题" />
      <TextField source="status" label="状态" />
      <TextField source="creator_id" label="创建者" />
      <NumberField source="chapters_count" label="章节数" />
      <DateField source="created_at" label="创建时间" showTime />
      <ShowButton />
    </Datagrid>
  </List>
);

export const CourseShow = () => (
  <Show>
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <TextField source="title" label="标题" />
      <TextField source="description" label="描述" />
      <TextField source="status" label="状态" />
      <TextField source="creator_id" label="创建者ID" />
      <NumberField source="chapters_count" label="章节数" />
      <NumberField source="total_duration" label="总时长(分钟)" />
      <DateField source="created_at" label="创建时间" showTime />
      <DateField source="updated_at" label="更新时间" showTime />
    </SimpleShowLayout>
  </Show>
);