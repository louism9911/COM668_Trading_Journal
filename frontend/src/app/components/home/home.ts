import { Component } from '@angular/core';
import { AuthService } from '../../services/auth-service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {

  constructor(protected authService: AuthService) {}
}
