sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/Device",
  "sap/ui/salesorder/store/model/models"
], function (UIComponent, Device, models) {
  "use strict";

  return UIComponent.extend("sap.ui.salesorder.store.Component", {
    metadata: {
      manifest: "json"
    },

    /**
     * Component initialization
     */
    init: function () {
      // Call parent init function
      UIComponent.prototype.init.apply(this, arguments);

      // Set the device model
      this.setModel(models.createDeviceModel(), "device");

      // Set shared reactive application state model
      this.setModel(models.createAppStateModel(), "appState");

      // Initialize the router
      this.getRouter().initialize();
    },

    /**
     * Returns content density class based on touch capability
     */
    getContentDensityClass: function () {
      if (!this._sContentDensityClass) {
        if (!Device.support.touch) {
          this._sContentDensityClass = "sapUiSizeCompact";
        } else {
          this._sContentDensityClass = "sapUiSizeCozy";
        }
      }
      return this._sContentDensityClass;
    }
  });
});
