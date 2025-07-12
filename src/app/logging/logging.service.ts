import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AngularPlugin } from '@microsoft/applicationinsights-angularplugin-js';
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

@Injectable()
export class LoggingService {
  private appInsights: ApplicationInsights;

  constructor(private router: Router) {
    var angularPlugin = new AngularPlugin();
    this.appInsights = new ApplicationInsights({ config: {
      instrumentationKey: '94ed7832-0ccb-4625-beb8-2feb1d218e08',
      extensions: [angularPlugin],
      extensionConfig: {
        [angularPlugin.identifier]: { router: this.router }
      }
    }});
    this.appInsights.loadAppInsights();
  }

  logEvent(name: string, properties?: { [key: string]: any }) {
    this.appInsights.trackEvent({ name }, properties);
  }

  logException(exception: Error, properties?: { [key: string]: any }) {
    this.appInsights.trackException({ exception }, properties);
  }

}