sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController"
], function (BaseController) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.PriceAvailability", {
    onInit: function () {
      var oRouter = this.getRouter();
      oRouter.getRoute("priceAvailability").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this.getModel("appState").setProperty("/currentStep", 5);
      this.recalculateTotals();
    },

    onNextToDelivery: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/currentStep", 6);
      this.navTo("deliveryMethod");
    },

    onNavToCart: function () {
      this.navTo("cart");
    },

    onNavHome: function () {
      this.navTo("launchpad");
    },

    // Step indicators
    onNavToStepLaunchpad: function () { this.navTo("launchpad"); },
    onNavToStep1: function () { this.navTo("customerSearch"); },
    onNavToStep2: function () { this.navTo("basicDetails"); },
    onNavToStep3: function () { this.navTo("consent"); },
    onNavToStep4: function () { this.navTo("orderType"); },
    onNavToStep5: function () { this.navTo("products"); },
    onNavToStep6: function () { this.navTo("deliveryMethod"); },
    onNavToStep7: function () { this.navTo("orderSummary"); },
    onNavToStepFinal: function () { this.navTo("orderFinal"); }
  });
});
