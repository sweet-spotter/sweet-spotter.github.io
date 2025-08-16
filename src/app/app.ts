import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ScannerComponent } from './scanner/scanner';
import { SweetenerTableComponent } from "./sweetener-table/sweetener-table";

@Pipe({ name: 'orderBySweetener' })
export class OrderBySweetenerPipe implements PipeTransform {
  transform(ingredients: Ingredient[]): Ingredient[] {
    // Sort ingredients with sweeteners first
    return ingredients
      .slice()
      .sort((a, b) => {
        const aHasSweetener = !!a.sweetener;
        const bHasSweetener = !!b.sweetener;
        if (aHasSweetener && !bHasSweetener) return -1;
        if (!aHasSweetener && bHasSweetener) return 1;
        return 0;
      });
  }
}

interface USDASearchResponse {
  totalHits: number;
  currentPage: number;
  totalPages: number;
  foods: [{
    brandName?: string;
    description: string;
    ingredients: string;
  }];
}

interface OpenFoodFactsResponse {
  product: OpenFoodFactsResponseProduct;
}

interface OpenFoodFactsResponseProduct {
  code: string;
  product_name: string;
  ingredients_text: string;
  ingredients: [{
    text: string;
  }];
  image_url: string;
  brands?: string;
}

interface Ingredient {
  name: string;
  sweetener: Sweetener | null;
}

export interface Sweetener {
  name: string;
  aliases: string[];
  rating: 'Safe' | 'Caution' | 'Avoid';
  source?: string;
}

interface Food {
  barcode?: string;
  description: string;
  ingredients: Ingredient[];
  sweeteners: Sweetener[];
  imageUrl?: string;
  brand?: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, OrderBySweetenerPipe, FormsModule, MatTableModule, MatProgressSpinnerModule, ScannerComponent, SweetenerTableComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  food: Food | null = null;
  scannerActive = false;
  loading = false;
  barcode: string | null = null;
  searchActive = false;
  searchText = '';
  searchLoading = false;
  searchResults: Food[] = [];

  sweeteners: Sweetener[] = [
  {
    name: 'Allulose',
    aliases: ['allulose', 'd-psicose', 'pseudo-fructose', 'd-allulose'],
    rating: 'Safe',
    source: 'https://www.cspi.org/article/allulose'
  }, {
    name: 'Monk Fruit',
    aliases: ['monk fruit', 'luo han guo', 'siraitia grosvenorii', 'swingle fruit', 'lo han kuo'],
    rating: 'Caution',
    source: 'https://www.cspi.org/article/monk-fruit-extract'
  }, {
    name: 'Stevia',
    aliases: ['stevia', 'steviol', 'rebiana', 'rebaudioside', 'stevioside', 'reb a', 'reb m'],
    rating: 'Safe', 
    source: 'https://www.cspi.org/article/stevia-leaf-extract-rebiana'
  }, {
    name: 'Aspartame',
    aliases: ['aspartame'],
    rating: 'Avoid',
    source: 'https://www.cspi.org/article/aspartame'
  }, {
    name: 'Advantame',
    aliases: ['advantame'],
    rating: 'Safe',
    source: 'https://www.cspi.org/article/advantame'
  }, {    
    name: 'Sucralose',
    aliases: ['sucralose', 'splenda'],
    rating: 'Avoid',
    source: 'https://www.cspi.org/article/sucralose'
  }, {
    name: 'Saccharin',
    aliases: ['saccharin'],
    rating: 'Avoid',
    source: 'https://www.cspi.org/article/saccharin'
  }, {
    name: 'Acesulfame Potassium',
    aliases: ['acesulfame potassium', 'ace-k'],
    rating: 'Avoid',
    source: 'https://www.cspi.org/article/acesulfame-potassium'
  }, {
    name: 'Neotame',
    aliases: ['neotame'],
    rating: 'Safe',
    source: 'https://www.cspi.org/article/neotame'
  }, {
    name: 'Sugar Alcohol',
    aliases: ['erythritol', 'xylitol', 'sorbitol', 'maltitol', 'isomalt', 'mannitol', 'xylitol', 'lactitol', 'polyglycitol', 'hydrogenated starch hydrolysates'],
    rating: 'Safe',
    source: 'https://www.cspi.org/article/erythritol'
  }, {
    name: 'Thaumatin',
    aliases: ['thaumatin', 'talin'],
    rating: 'Safe',
    source: 'https://www.cspi.org/article/thaumatin'
  }];

  get foodNotFound(): boolean {
    if (!this.food) return false;
    return this.food.description === 'Not found';
  }

  get foodBrand(): string | null {
    if (!this.food || !this.food.brand) return null;
    return `(${this.food.brand})`;
  }

  constructor(
    private http: HttpClient
  ) {
    this.sweeteners = this.sweeteners.sort((a, b) => a.name.localeCompare(b.name));
    //this.lookupOpenFoodFacts('644209101139')
  }

  ngOnInit(): void {}

  startTextSearch() {
    this.food = null;
    this.searchActive = true;
    this.searchText = '';
    this.searchResults = [];
    this.searchLoading = false;
  }

  searchProducts() {
    if (!this.searchText.trim()) return;
    this.searchLoading = true;
    this.searchResults = [];
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(this.searchText)}&search_simple=1&json=1&action=process&fields=product_name,image_url,ingredients_text,ingredients,code,brands&sort_by=unique_scans_n`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data && data.products) {
          this.searchResults = data.products
            .filter((product: any) => product.product_name && product.ingredients && product.ingredients.length > 0)
            .map((product: any) => this.getFoodFromOpenFoodFacts(product));
        } else {
          this.searchResults = [];
        }
        this.searchLoading = false;
      })
      .catch((error) => {
        console.log(error);
        this.searchResults = [];
        this.searchLoading = false;
      });
  }

  selectProduct(food: Food) {
    this.searchActive = false;
    this.scannerActive = false;
    this.food = food;
  }

  lookupFoodUSDA(barcode: string): void {
    this.barcode = barcode;
    this.loading = true;
    const usdaApiUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(barcode)}&pageSize=1&api_key=tyk58FSKxVyNkZEpBUaEKtGRIXhDOBwTyVekPw4W`;
    this.http.get<USDASearchResponse>(usdaApiUrl).subscribe(
      response => {
        console.log('USDA API response:', response);
        if (response.totalHits > 0 && response.foods[0]?.ingredients) {
          this.setFoodFromUsda(response);
        } else {
          this.setFoodNotFound();
        }
        this.loading = false;
      },
      error => {
        console.error('USDA API error:', error);
        this.setFoodNotFound();
        this.loading = false;
      }
    );
  }

  closeFoodCard() {
    this.food = null;
    this.scannerActive = false;
    this.searchResults = [];
    this.searchText = '';
    this.searchActive = false;
  }

  lookupOpenFoodFacts(barcode: string): void {
    const offApiUrl = `https://world.openfoodfacts.net/api/v2/product/${encodeURIComponent(barcode)}&fields=product_name,image_url,ingredients_text,ingredients,code,brands`;
    this.http.get<OpenFoodFactsResponse>(offApiUrl).subscribe(
      offResponse => {
        console.log('Open Food Facts API response:', offResponse);
        if (offResponse && offResponse.product) {
          this.food = this.getFoodFromOpenFoodFacts(offResponse.product);
        } else {
          this.lookupFoodUSDA(barcode);
        }
      },
      offError => {
        console.error('Open Food Facts API error:', offError);
        this.lookupFoodUSDA(barcode);
      }
    );
  }

  private setFoodNotFound() {
    this.food = {
      description: `Not found`,
      ingredients: [],
      sweeteners: []
    };
  }

  private setFoodFromUsda(response: USDASearchResponse): void {
    const foodData = response.foods[0];
    this.food = {
      description: foodData.description,
      ingredients: [],
      sweeteners: [],
      brand: foodData.brandName
    };
    this.food.ingredients = this.parseIngredients(foodData.ingredients);
    this.food.sweeteners = this.getSweetenersFromIngredients(this.food.ingredients);
  }

  private getFoodFromOpenFoodFacts(product: OpenFoodFactsResponseProduct): Food {
    const food: Food = {
      barcode: product.code,
      description: product.product_name,
      ingredients: [],
      sweeteners: [],
      imageUrl: product.image_url,
      brand: product.brands ? product.brands.split(',')[0].trim() : undefined
    };
    if (product.ingredients && product.ingredients.length > 0) {
      product.ingredients.forEach(ingredient => {
        food?.ingredients.push({
          name: ingredient.text,
          sweetener: this.findSweetener(ingredient.text)
        });
      });
      food.sweeteners = this.getSweetenersFromIngredients(food.ingredients);
    }
    return food;
  }

  private parseIngredients(ingredientsText: string): Ingredient[] {
    // replace all open brack and parenthesis with commas
    //ingredientsText = ingredientsText.replace(/[\(\[]/g, ',').replace(/[\)\]]/g, ',');
    // Split on commas, trim whitespace, and normalize spaces
    // Don't split on commas inside parentheses or brackets
    ingredientsText = ingredientsText.replace(/[\(\[].*?[\)\]]/g, match => {
      // Replace commas inside parentheses or brackets with a placeholder
      return match.replace(/,/g, '␣'); // Use a unique placeholder
    });
    const ingredients = ingredientsText
      .split(',')
      .map(part => part.trim().replace(/[\u00A0;:.]/g, ' ').replace(/ +/g, ' ').replace(/␣/g, ','))
      .filter(name => !!name)
      .map(name => ({
        name,
        sweetener: this.findSweetener(name)
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
    for (const sweetener of this.sweeteners) {
      if (sweetener.aliases.some(alias => normalizedIngredient.includes(alias))) {
        return sweetener;
      }
    }
    return null;
  }

  private getSweetenersFromIngredients(ingredients: Ingredient[]): Sweetener[] {
    return ingredients
      .map((ingredient: any) => ingredient.sweetener)
      .filter((sweetener: Sweetener | null, index: number, arr: (Sweetener | null)[]) =>
        sweetener !== null && arr.findIndex(s => s && sweetener && s.name === sweetener.name) === index
      );
  }

}