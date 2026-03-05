import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { Login } from './components/login/login';
import { Register } from './components/register/register';
import { Dashboard } from './components/dashboard/dashboard';
import { Journal } from './components/journal/journal';
import { AddTrade } from './components/add-trade/add-trade';
import { Trade } from './components/trade/trade';
import { Upload } from './components/upload/upload';
import { Research } from './components/research/research';
import { Account } from './components/account/account';
import { Admin } from './components/admin/admin';

export const routes: Routes = [
  { path: '',            component: Home },
  { path: 'login',       component: Login },
  { path: 'register',    component: Register },
  { path: 'dashboard',   component: Dashboard },
  { path: 'journal',     component: Journal },
  { path: 'journal/add', component: AddTrade },
  { path: 'journal/:id', component: Trade },
  { path: 'upload',      component: Upload },
  { path: 'research',    component: Research },
  { path: 'account',     component: Account },
  { path: 'admin',       component: Admin },
];
