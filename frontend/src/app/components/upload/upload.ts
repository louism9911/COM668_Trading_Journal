import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { WebService } from '../../services/web-service';
import { AuthService } from '../../services/auth-service';

@Component({
  selector: 'app-upload',
  imports: [CommonModule, RouterModule],
  providers: [WebService],
  templateUrl: './upload.html',
  styleUrl: './upload.css'
})
export class Upload {

  selectedFile: File | null = null;
  fileName: string = '';
  isUploading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  tradesImported: number = 0;
  tradesSkipped: number = 0;

  fileError: string = '';

  constructor(
    private webService: WebService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
  }

  // Handle file input change
  onFileSelected(event: any) {
    this.clearMessages();
    this.fileError = '';

    const file = event.target.files[0];
    if (!file) {
      this.selectedFile = null;
      this.fileName = '';
      return;
    }

    // Validate file type — HTML only
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'html' && extension !== 'htm') {
      this.fileError = 'Only HTML files (.html, .htm) are allowed. Please select a valid MetaTrader export.';
      this.selectedFile = null;
      this.fileName = '';
      event.target.value = '';
      return;
    }

    // Client-side validation: file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.fileError = 'File size exceeds 5MB. Please select a smaller file.';
      this.selectedFile = null;
      this.fileName = '';
      event.target.value = '';
      return;
    }

    this.selectedFile = file;
    this.fileName = file.name;
  }

  // Upload file to backend
  onUpload() {
    if (!this.selectedFile) return;

    this.clearMessages();
    this.isUploading = true;

    this.webService.uploadHTML(this.selectedFile).subscribe({
      next: (response: any) => {
        this.isUploading = false;
        this.tradesImported = response.trades_imported;
        this.tradesSkipped = response.trades_skipped;
        this.successMessage = response.message;
        // Reset file input
        this.selectedFile = null;
        this.fileName = '';
      },
      error: (error: any) => {
        this.isUploading = false;
        if (error.error?.message) {
          this.errorMessage = error.error.message;
        } else if (error.error?.error) {
          this.errorMessage = error.error.error;
        } else {
          this.errorMessage = 'Upload failed. Please try again.';
        }
      }
    });
  }

  // Navigate to journal after successful upload
  goToJournal() {
    this.router.navigate(['/journal']);
  }

  clearMessages() {
    this.errorMessage = '';
    this.successMessage = '';
    this.tradesImported = 0;
    this.tradesSkipped = 0;
  }
}
