import { Component, EventEmitter, inject, Input, OnInit, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CameraDevice, Html5Qrcode } from "html5-qrcode";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LoggingService } from '../logging/logging.service';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-scanner',
  imports: [CommonModule, FormsModule, MatProgressSpinnerModule, MatSelectModule],
  templateUrl: './scanner.html',
  styleUrl: './scanner.scss'
})
export class ScannerComponent implements OnInit, OnChanges {
  @Input() scannerActive = false;
  @Output() scannerActiveChange = new EventEmitter<boolean>();
  @Output() foodScanned = new EventEmitter<string>();  
  cameras: CameraDevice[] = [];
  selectedCameraId: string | null = null;
  barcode: string | null = null;
  private html5QrCode: Html5Qrcode | null = null;
  private _snackBar = inject(MatSnackBar);

  constructor(
    private loggingService: LoggingService
  ) {}

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['scannerActive']) {
      const current = changes['scannerActive'].currentValue;
      if (current) {
        // Parent activated scanner
        this.startScanner();
      } else {
        // Parent deactivated scanner
        this.closeScanner();
      }
    }
  }

  toggleScanner() {
    this.changeScannerActive(!this.scannerActive);
    if (this.scannerActive) {
      this.startScanner();
    } else {
      this.closeScanner();
    }
  }

  onCameraChange(event: any): void {
    if (this.scannerActive) {
      this.closeScanner();
      setTimeout(() => this.initScanner(), 0);
    }
  }

  private startScanner(): void {
    this.barcode = null;
    Html5Qrcode.getCameras().then(devices => {
      this.cameras = devices;
      if (devices.length === 0) {
        console.error("No cameras found.");
        this.changeScannerActive(false);
        return;
      }
      const cameraPriorityOrder = ["back ultra wide", "back", "rear", "primary"];
      // Find the first camera that matches our priority order
      let priorityCamera: CameraDevice | undefined = undefined;
      for (const priority of cameraPriorityOrder) {
        const camera = devices.find(d => d.label.toLowerCase().includes(priority));
        if (camera) {
          priorityCamera = camera;
          break;
        }
      }
      if (priorityCamera) {
        this.selectedCameraId = priorityCamera.id;
      } else {
        this.selectedCameraId = devices[0].id; // Fallback to first camera
      }
      console.log("Available cameras:", devices);
      setTimeout(() => this.initScanner(), 0); // ensure DOM is updated
    }).catch(err => {
      this.loggingService.logException(new Error(`Error getting cameras: ${err}`));
      console.error("Error getting cameras:", err);
      this.showError("Unable to access camera. Please check permissions.");
      this.changeScannerActive(false);
    });
  }

  private closeScanner(): void {
    if (this.html5QrCode) {
      this.html5QrCode.stop().then(() => {
        console.log("Scanner stopped.");
      }).catch(err => {
        this.loggingService.logException(new Error(`Error stopping scanner: ${err}`));
        console.error("Error stopping scanner:", err);
      });
    }
  }

  private initScanner(): void {
    const readerDiv = document.getElementById("reader");
    if (!readerDiv) {
      setTimeout(() => this.initScanner(), 100); // Try again shortly
      return;
    }
    if (this.selectedCameraId === null) {
      this.showError("No camera selected. Please use a device with a camera.");
      console.error("No camera selected.");
      this.changeScannerActive(false);
      return;
    }
    this.html5QrCode = new Html5Qrcode("reader");
    this.html5QrCode.start(
      this.selectedCameraId,
      { fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      (decodedText, decodedResult) => {
        console.log(`Decoded text: ${decodedText}`, decodedResult);
        this.loggingService.logEvent('QRCodeScanned', { code: decodedText });
        if (decodedText.length != 8 && decodedText.length != 13 && decodedText.length != 12) {
          console.warn(`Invalid code detected: ${decodedText}`);
          return; // Ignore short codes
        }
        console.log(`Code matched = ${decodedText}`, decodedResult);
        this.barcode = decodedText;
        if (this.html5QrCode) {
          this.html5QrCode.stop();
        }
        this.changeScannerActive(false);
        let barcode = decodedText;
        // If the barcode starts with '0' and it's 13 characters long, remove it
        if (decodedText.startsWith('0') && decodedText.length === 13) {
          barcode = decodedText.substring(1);
        }
        this.foodScanned.emit(barcode);
      },
      (errorMessage) => {
      }
    ).catch((err) => {
      this.loggingService.logException(new Error(`Scanner initialization error: ${err}`));
      this.showError("Unable to start scanner. Please check camera permissions.");
      console.error(`Unable to start scanning, error: ${err}`);
      this.changeScannerActive(false);
    });
  }

  private showError(message: string) {
    this._snackBar.open(message, 'Close');
  }

  private changeScannerActive(newValue: boolean) {
    this.scannerActive = newValue;
    this.scannerActiveChange.emit(this.scannerActive);
  }

}