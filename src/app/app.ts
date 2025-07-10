import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CameraDevice, Html5Qrcode } from "html5-qrcode";
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Pipe({ name: 'orderBySweetener' })
export class OrderBySweetenerPipe implements PipeTransform {
  transform(ingredients: Ingredient[]): Ingredient[] {
    // Sort ingredients with sweeteners first
    return ingredients
      .slice()
      .sort((a, b) => {
        const aHasSweetener = !!a.sweeter;
        const bHasSweetener = !!b.sweeter;
        if (aHasSweetener && !bHasSweetener) return -1;
        if (!aHasSweetener && bHasSweetener) return 1;
        return 0;
      });
  }
}

interface FoodSearchResponse {
  totalHits: number;
  currentPage: number;
  totalPages: number;
  foods: any[];
}

interface Ingredient {
  name: string;
  sweeter: Sweetener | null;
}

interface Sweetener {
  name: string;
  aliases: string[];
  rating: 'safe' | 'caution' | 'avoid';
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HttpClientModule, CommonModule, OrderBySweetenerPipe, FormsModule, MatTableModule, MatProgressSpinnerModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  food: any = null;
  scannerActive = false;
  cameras: CameraDevice[] = [];
  selectedCameraId: string | null = null;
  noItemFound = false;
  loading = false;
  sweetenerDict: Sweetener[] = [
  {
    name: 'Allulose',
    aliases: ['allulose', 'd-psicose'],
    rating: 'safe'
  }, {
    name: 'Monk Fruit',
    aliases: ['monk fruit', 'luo han guo', 'siraitia grosvenorii', 'swingle fruit', 'lo han kuo'],
    rating: 'safe'
  }, {
    name: 'Stevia',
    aliases: ['stevia', 'steviol', 'rebiana', 'rebaudioside', 'stevioside', 'reb a', 'reb m'],
    rating: 'safe'
  }, {
    name: 'Aspartame',
    aliases: ['aspartame'],
    rating: 'avoid'
  }, {
    name: 'Sucralose',
    aliases: ['sucralose', 'splenda'],
    rating: 'avoid'
  }, {
    name: 'Saccharin',
    aliases: ['saccharin'],
    rating: 'avoid'
  }, {
    name: 'Acesulfame Potassium',
    aliases: ['acesulfame potassium', 'ace-k'],
    rating: 'caution'
  }, {
    name: 'Neotame',
    aliases: ['neotame'],
    rating: 'avoid'
  }, {
    name: 'Sugar Alcohol',
    aliases: ['erythritol', 'xylitol', 'sorbitol', 'maltitol', 'isomalt', 'mannitol', 'xylitol'],
    rating: 'safe'
  }];
  private html5QrCode: Html5Qrcode | null = null;
  private _snackBar = inject(MatSnackBar);

  constructor(private http: HttpClient) {
    //sort sweetenerDict by name
    this.sweetenerDict = this.sweetenerDict.sort((a, b) => a.name.localeCompare(b.name));
    navigator.permissions.query({name: 'camera'})
    .then((permissionObj) => {
      console.log('Camera permission ' + permissionObj.state);
    })
    .catch((error) => {
      console.log('Got camera permission error :', error);
    })
  }

  ngOnInit(): void {}

  toggleScanner() {
    this.scannerActive = !this.scannerActive;
    if (this.scannerActive) {
      this.startScanner();
    } else {
      this.closeScanner();
    }
  }

  onCameraChange(event: Event): void {
    if (this.scannerActive) {
      this.closeScanner();
      setTimeout(() => this.initScanner(), 0);
    }
  }

  private startScanner(): void {
    this.food = null;
    this.noItemFound = false;
    Html5Qrcode.getCameras().then(devices => {
      this.cameras = devices;
      if (devices.length === 0) {
        console.error("No cameras found.");
        this.scannerActive = false;
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
    });
  }

  private closeScanner(): void {
    if (this.html5QrCode) {
      this.html5QrCode.stop().then(() => {
        console.log("Scanner stopped.");
      }).catch(err => {
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
      this.scannerActive = false;
      return;
    }
    this.html5QrCode = new Html5Qrcode("reader");
    this.html5QrCode.start(
      this.selectedCameraId,
      { fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      (decodedText, decodedResult) => {
        if (decodedText.length != 8 && decodedText.length != 13 && decodedText.length != 12) {
          console.warn(`Invalid code detected: ${decodedText}`);
          return; // Ignore short codes
        }
        console.log(`Code matched = ${decodedText}`, decodedResult);
        if (this.html5QrCode) {
          this.html5QrCode.stop();
        }
        this.scannerActive = false;
        let barcode = decodedText;
        // If the barcode starts with '0' and it's 13 characters long, remove it
        if (decodedText.startsWith('0') && decodedText.length === 13) {
          barcode = decodedText.substring(1);
        }
        this.lookupFood(barcode);
      },
      (errorMessage) => {
      }
    ).catch((err) => {
      this.showError("Unable to start scanner. Please check camera permissions.");
      console.error(`Unable to start scanning, error: ${err}`);
      this.scannerActive = false;
    });
  }

  private lookupFood(barcode: string): void {
    this.loading = true;
    this.noItemFound = false;
    const usdaApiUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(barcode)}&pageSize=10&api_key=tyk58FSKxVyNkZEpBUaEKtGRIXhDOBwTyVekPw4W`;
    this.http.get<FoodSearchResponse>(usdaApiUrl).subscribe(
      response => {
        console.log('USDA API response:', response);
        if (response.totalHits > 0 && response.foods[0]?.ingredients) {
          this.setFoodFromUsda(response.foods[0]);
          this.loading = false;
        } else {
          this.lookupOpenFoodFacts(barcode);
        }
      },
      error => {
        console.error('USDA API error:', error);
        this.lookupOpenFoodFacts(barcode);
      }
    );
  }

  private lookupOpenFoodFacts(barcode: string): void {
    const offApiUrl = `https://world.openfoodfacts.net/api/v2/product/${encodeURIComponent(barcode)}`;
    this.http.get<any>(offApiUrl).subscribe(
      offResponse => {
        console.log('Open Food Facts API response:', offResponse);
        if (offResponse && offResponse.product) {
          this.setFoodFromOpenFoodFacts(offResponse.product);
        } else {
          this.food = null;
          this.noItemFound = true;
        }
        this.loading = false;
      },
      offError => {
        console.error('Open Food Facts API error:', offError);
        this.food = null;
        this.noItemFound = true;
        this.loading = false;
      }
    );
  }

  private setFoodFromUsda(foodData: any): void {
    this.food = foodData;
    this.food.ingredients = this.parseIngredients(foodData.ingredients);
    this.food.sweeteners = this.getSweetenersFromIngredients(this.food.ingredients);
  }

  private setFoodFromOpenFoodFacts(product: any): void {
    this.food = {
      description: product.product_name,
      ingredients: []
    };
    const ingredientsText = product.ingredients_text_debug || product.ingredients_text;
    if (ingredientsText) {
      this.food.ingredients = this.parseIngredients(ingredientsText);
      this.food.sweeteners = this.getSweetenersFromIngredients(this.food.ingredients);
    }
  }

  private parseIngredients(ingredientsText: string): Ingredient[] {
    // replace all open brack and parenthesis with commas
    ingredientsText = ingredientsText.replace(/[\(\[]/g, ',').replace(/[\)\]]/g, ',');
    // Split on commas, ignore any grouping/children logic
    const ingredients = ingredientsText
      .split(',')
      .map(part => part.trim().replace(/[\u00A0;:.]/g, ' ').replace(/ +/g, ' '))
      .filter(name => !!name)
      .map(name => ({
        name,
        sweeter: this.findSweetener(name)
      }));
    const uniqueIngredients: { [key: string]: Ingredient } = {};
    for (const ingredient of ingredients) {
      const trimmedName = ingredient.name.trim();
      if (trimmedName && !uniqueIngredients[trimmedName]) {
        uniqueIngredients[trimmedName] = ingredient;
      }
    }
    return Object.values(uniqueIngredients);
  }

  private findSweetener(ingredient: string): Sweetener | null {
    const normalizedIngredient = ingredient.toLowerCase();
    for (const sweetener of this.sweetenerDict) {
      if (sweetener.aliases.some(alias => normalizedIngredient.includes(alias))) {
        return sweetener;
      }
    }
    return null;
  }

  private getSweetenersFromIngredients(ingredients: Ingredient[]): Sweetener[] {
    return this.food.ingredients
      .map((ingredient: any) => ingredient.sweeter)
      .filter((sweeter: Sweetener | null, index: number, arr: (Sweetener | null)[]) =>
        sweeter !== null && arr.findIndex(s => s && sweeter && s.name === sweeter.name) === index
      );
  }

  private showError(message: string) {
    this._snackBar.open(message, 'Close');
  }

}