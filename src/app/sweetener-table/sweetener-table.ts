import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { Sweetener } from '../app';

@Component({
  selector: 'app-sweetener-table',
  imports: [CommonModule, MatTableModule],
  templateUrl: './sweetener-table.html',
  styleUrl: './sweetener-table.scss'
})
export class SweetenerTableComponent {
  @Input() sweeteners: Sweetener[] = [];

  constructor() {}

}
