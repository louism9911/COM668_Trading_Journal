import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class WebService {

  // Base URL for the Flask API
  private baseURL: string = 'http://localhost:5050/api/v1.0';

  constructor(private http: HttpClient) {}

  // ─── Auth ─────────────────────────────────────────────

  // POST /register - create a new user account
  register(username: string, password: string) {
    let postData = { username: username, password: password };
    return this.http.post<any>(
      this.baseURL + '/register', postData);
  }

  // GET /login - authenticate with Basic Auth, returns JWT
  login(username: string, password: string) {
    let headers = new HttpHeaders({
      'Authorization': 'Basic ' + btoa(username + ':' + password)
    });
    return this.http.get<any>(
      this.baseURL + '/login', { headers: headers });
  }

  // GET /logout - blacklist the current token
  logout() {
    let headers = this.getTokenHeader();
    return this.http.get<any>(
      this.baseURL + '/logout', { headers: headers });
  }

  // ─── Trades ───────────────────────────────────────────

  // GET /trades - paginated list of user's trades
  getTrades(page: number, pageSize: number) {
    let headers = this.getTokenHeader();
    return this.http.get<any>(
      this.baseURL + '/trades?pn=' + page + '&ps=' + pageSize,
      { headers: headers });
  }

  // GET /trades/:id - single trade by ID
  getTrade(id: string) {
    let headers = this.getTokenHeader();
    return this.http.get<any>(
      this.baseURL + '/trades/' + id,
      { headers: headers });
  }

  // POST /trades - create a new trade
  addTrade(tradeData: any) {
    let headers = this.getTokenHeader();
    return this.http.post<any>(
      this.baseURL + '/trades', tradeData,
      { headers: headers });
  }

  // PUT /trades/:id - update an existing trade
  updateTrade(id: string, tradeData: any) {
    let headers = this.getTokenHeader();
    return this.http.put<any>(
      this.baseURL + '/trades/' + id, tradeData,
      { headers: headers });
  }

  // DELETE /trades/:id - delete a trade
  deleteTrade(id: string) {
    let headers = this.getTokenHeader();
    return this.http.delete<any>(
      this.baseURL + '/trades/' + id,
      { headers: headers });
  }

  // ─── Tags ─────────────────────────────────────────────

  // GET /trades/:id/tags - list tags on a trade
  getTags(tradeId: string) {
    let headers = this.getTokenHeader();
    return this.http.get<any>(
      this.baseURL + '/trades/' + tradeId + '/tags',
      { headers: headers });
  }

  // POST /trades/:id/tags - add a tag to a trade
  addTag(tradeId: string, tagData: any) {
    let headers = this.getTokenHeader();
    return this.http.post<any>(
      this.baseURL + '/trades/' + tradeId + '/tags', tagData,
      { headers: headers });
  }

  // PUT /trades/:tradeId/tags/:tagId - update a tag
  updateTag(tradeId: string, tagId: string, tagData: any) {
    let headers = this.getTokenHeader();
    return this.http.put<any>(
      this.baseURL + '/trades/' + tradeId + '/tags/' + tagId,
      tagData, { headers: headers });
  }

  // DELETE /trades/:tradeId/tags/:tagId - delete a tag
  deleteTag(tradeId: string, tagId: string) {
    let headers = this.getTokenHeader();
    return this.http.delete<any>(
      this.baseURL + '/trades/' + tradeId + '/tags/' + tagId,
      { headers: headers });
  }

  // ─── Analytics ────────────────────────────────────────

  // Build optional date range query string
  private dateParams(dateFrom?: string, dateTo?: string): string {
    const parts: string[] = [];
    if (dateFrom) parts.push('date_from=' + encodeURIComponent(dateFrom));
    if (dateTo)   parts.push('date_to='   + encodeURIComponent(dateTo));
    return parts.length ? '?' + parts.join('&') : '';
  }

  // GET /analytics/summary - user performance summary
  getAnalyticsSummary(dateFrom?: string, dateTo?: string) {
    let headers = this.getTokenHeader();
    return this.http.get<any>(
      this.baseURL + '/analytics/summary' + this.dateParams(dateFrom, dateTo),
      { headers: headers });
  }

  // GET /analytics/by-symbol - grouped by trading symbol
  getAnalyticsBySymbol(dateFrom?: string, dateTo?: string) {
    let headers = this.getTokenHeader();
    return this.http.get<any>(
      this.baseURL + '/analytics/by-symbol' + this.dateParams(dateFrom, dateTo),
      { headers: headers });
  }

  // GET /analytics/by-month - grouped by month
  getAnalyticsByMonth(dateFrom?: string, dateTo?: string) {
    let headers = this.getTokenHeader();
    return this.http.get<any>(
      this.baseURL + '/analytics/by-month' + this.dateParams(dateFrom, dateTo),
      { headers: headers });
  }

  // GET /analytics/by-type - grouped by buy/sell
  getAnalyticsByType(dateFrom?: string, dateTo?: string) {
    let headers = this.getTokenHeader();
    return this.http.get<any>(
      this.baseURL + '/analytics/by-type' + this.dateParams(dateFrom, dateTo),
      { headers: headers });
  }

  // GET /analytics/top-trades - top N trades by profit
  getTopTrades(limit: number, dateFrom?: string, dateTo?: string) {
    let headers = this.getTokenHeader();
    const base = this.baseURL + '/analytics/top-trades?limit=' + limit;
    const extra = dateFrom || dateTo ? '&' + this.dateParams(dateFrom, dateTo).slice(1) : '';
    return this.http.get<any>(base + extra, { headers: headers });
  }

  // GET /analytics/tags - performance by strategy, emotion, entry type
  getTagAnalytics(dateFrom?: string, dateTo?: string) {
    let headers = this.getTokenHeader();
    return this.http.get<any>(
      this.baseURL + '/analytics/tags' + this.dateParams(dateFrom, dateTo),
      { headers: headers });
  }

  // ─── News ─────────────────────────────────────────────

  // GET /news?q=keyword - proxy to NewsAPI
  getNews(query: string) {
    let headers = this.getTokenHeader();
    return this.http.get<any>(
      this.baseURL + '/news?q=' + encodeURIComponent(query),
      { headers: headers });
  }

  // ─── Uploads ────────────────────────────────────────

  // POST /trades/upload/html - upload and parse HTML broker statement
  uploadHTML(file: File) {
    let token = sessionStorage.getItem('token') || '';
    let headers = new HttpHeaders({ 'x-access-token': token });
    let formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<any>(
      this.baseURL + '/trades/upload/html', formData,
      { headers: headers });
  }

  // ─── Account & Admin ──────────────────────────────────

  // PUT /users/me - update account (username and/or password)
  updateAccount(payload: { new_username?: string; current_password?: string; new_password?: string }) {
    let headers = this.getTokenHeader();
    return this.http.put<any>(
      this.baseURL + '/users/me', payload, { headers: headers });
  }

  // DELETE /users/me - delete own account
  deleteMyAccount() {
    let headers = this.getTokenHeader();
    return this.http.delete<any>(
      this.baseURL + '/users/me', { headers: headers });
  }

  // GET /admin/users - list all users (admin only)
  getAdminUsers() {
    let headers = this.getTokenHeader();
    return this.http.get<any>(
      this.baseURL + '/admin/users', { headers: headers });
  }

  // DELETE /admin/users/:id - delete any user (admin only)
  adminDeleteUser(userId: string) {
    let headers = this.getTokenHeader();
    return this.http.delete<any>(
      this.baseURL + '/admin/users/' + userId, { headers: headers });
  }

  // ─── Helper ───────────────────────────────────────────

  // Build headers with the JWT token from sessionStorage
  private getTokenHeader(): HttpHeaders {
    let token = sessionStorage.getItem('token') || '';
    return new HttpHeaders({ 'x-access-token': token });
  }
}
