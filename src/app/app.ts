import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Html5Qrcode } from "html5-qrcode";
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';

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
  rating: 'green' | 'yellow' | 'red';
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HttpClientModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  food: any = null;
  scannerActive = false;  
  private sweeteners: Sweetener[] = [{
    name: 'Sugar',
    aliases: ['sugar', 'table sugar', 'granulated sugar'],
    rating: 'red'
  }, {
    name: 'Stevia',
    aliases: ['stevia', 'steviol glycosides'],
    rating: 'green'
  }, {
    name: 'Aspartame',
    aliases: ['aspartame'],
    rating: 'red'
  }, {
    name: 'Sucralose',
    aliases: ['sucralose', 'Splenda'],
    rating: 'yellow'
  }, {
    name: 'Saccharin',
    aliases: ['saccharin'],
    rating: 'red'
  }, {
    name: 'Acesulfame Potassium',
    aliases: ['acesulfame potassium', 'Ace-K'],
    rating: 'yellow'
  }, {
    name: 'Neotame',
    aliases: ['neotame'],
    rating: 'red'
  }];
//    'sugar', 'stevia', 'aspartame', 'sucralose', 'saccharin', 'acesulfame potassium', 'neotame', 'glycerine',
//    'sorbitol', 'xylitol', 'maltitol', 'erythritol', 'isomalt', 'mannitol', 'lactitol', 'steviol glycosides',
//    'monk fruit extract', 'allulose', 'tagatose', 'trehalose', 'dextrose', 'glucose', 'fructose',
//    'high fructose corn syrup', 'corn syrup solids', 'honey', 'agave nectar'
//  ];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {}

  startScanner(): void {
    this.scannerActive = true;
    setTimeout(() => this.initScanner(), 0); // ensure DOM is updated
  }

  closeScanner(): void {
    this.scannerActive = false;
  }

  private initScanner(): void {
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length) {
        const cameraId = devices[0].id;
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCode.start(
          cameraId,
          { fps: 10 },
          (decodedText, decodedResult) => {
            console.log(`Code matched = ${decodedText}`, decodedResult);
            html5QrCode.stop();
            this.scannerActive = false;
            const barcode = decodedText.substring(1);
            this.lookupFood(barcode);
          },
          (errorMessage) => {
            // handle scan error
          }
        ).catch((err) => {
          console.error(`Unable to start scanning, error: ${err}`);
          this.scannerActive = false;
        });
      }
    }).catch(err => {
      // handle err
      this.scannerActive = false;
    });
  }

  private lookupFood(barcode: string): void {
    const usdaApiUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(barcode)}&pageSize=10&api_key=DEMO_KEY`;
    this.http.get<FoodSearchResponse>(usdaApiUrl).subscribe(
      response => {
        console.log('USDA API response:', response);
        if (response.totalHits > 0 && response.foods[0]?.ingredients) {
          this.setFoodFromUsda(response.foods[0]);
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
        }
      },
      offError => {
        console.error('Open Food Facts API error:', offError);
        this.food = null;
      }
    );
  }

  private setFoodFromUsda(foodData: any): void {
    this.food = foodData;
    this.food.ingredients = this.parseIngredients(foodData.ingredients);
  }

  private setFoodFromOpenFoodFacts(product: any): void {
    this.food = {
      description: product.product_name,
      ingredients: []
    };
    if (product.ingredients_text) {
      this.food.ingredients = this.parseIngredients(product.ingredients_text);
    }
  }

  private parseIngredients(ingredientsText: string): Ingredient[] {
    return ingredientsText
      .split(/,(?![^(]*\))/)
      .map((ingredient: string) => {
        const trimmed = ingredient.trim();
        return { name: trimmed, sweeter: this.findSweetener(trimmed) };
      });
  }

  private findSweetener(ingredient: string): Sweetener | null {
    const normalizedIngredient = ingredient.toLowerCase();
    for (const sweetener of this.sweeteners) {
      if (sweetener.aliases.some(alias => normalizedIngredient.includes(alias))) {
        return sweetener;
      }
    }
    return null;
  }
}