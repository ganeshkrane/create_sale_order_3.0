sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController"
], function (BaseController) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.DeliveryMethod", {
    onInit: function () {
      var oRouter = this.getRouter();
      oRouter.getRoute("deliveryMethod").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this.getModel("appState").setProperty("/currentStep", 6);
    },

    onSelectDeliveryMethodToCustomer: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/methodKey", "DELIVERY");
      oAppState.setProperty("/delivery/methodTitle", "Delivery to Customer");
    },

    onSelectInStoreCollection: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/methodKey", "COLLECTION");
      oAppState.setProperty("/delivery/methodTitle", "In-Store Collection");
    },

    onSelectWarehousePickup: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/methodKey", "WAREHOUSE");
      oAppState.setProperty("/delivery/methodTitle", "Warehouse Pickup");
    },

    onNextToDeliveryAddress: function () {
      this.navTo("deliveryAddress");
    },

    onNavToPriceAvailability: function () {
      this.navTo("priceAvailability");
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
