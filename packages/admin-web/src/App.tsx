import React from 'react';
import { Admin, Resource } from 'react-admin';
import authProvider from './authProvider';
import dataProvider from './dataProvider';
import Dashboard from './dashboard';
import { UserList, UserShow } from './resources/users';
import { CourseList, CourseShow } from './resources/courses';

const App = () => (
  <Admin
    authProvider={authProvider}
    dataProvider={dataProvider}
    dashboard={Dashboard}
  >
    <Resource name="users" list={UserList} show={UserShow} />
    <Resource name="courses" list={CourseList} show={CourseShow} />
  </Admin>
);

export default App;