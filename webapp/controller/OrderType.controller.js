sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController"
], function (BaseController) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.OrderType", {
    onInit: function () {
      var oRouter = this.getRouter();
      oRouter.getRoute("orderType").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this.getModel("appState").setProperty("/currentStep", 4);
    },

    onOrderTypeChange: function (oEvent) {
      var sKey = oEvent.getParameter("selectedItem").getKey();
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/orderHeader/orderType", sKey);
      if (sKey === "ZOR") {
        oAppState.setProperty("/orderHeader/orderTypeName", "Standard Store Order");
        oAppState.setProperty("/orderHeader/orderTypeDesc", "ZOR · Take-away / collect today");
      } else if (sKey === "ZDL") {
        oAppState.setProperty("/orderHeader/orderTypeName", "Delivery Order");
        oAppState.setProperty("/orderHeader/orderTypeDesc", "ZDL · Deliver to customer");
      } else if (sKey === "ZSP") {
        oAppState.setProperty("/orderHeader/orderTypeName", "Special / Supply Order");
        oAppState.setProperty("/orderHeader/orderTypeDesc", "ZSP · Warehouse Supply");
      }
    },

    onSelectOrderTypeZOR: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/orderHeader/orderType", "ZOR");
      oAppState.setProperty("/orderHeader/orderTypeName", "Standard Store Order");
      oAppState.setProperty("/orderHeader/orderTypeDesc", "ZOR · Take-away / collect today");
    },

    onSelectOrderTypeZDL: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/orderHeader/orderType", "ZDL");
      oAppState.setProperty("/orderHeader/orderTypeName", "Delivery Order");
      oAppState.setProperty("/orderHeader/orderTypeDesc", "ZDL · Deliver to customer");
    },

    onSelectOrderTypeZSP: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/orderHeader/orderType", "ZSP");
      oAppState.setProperty("/orderHeader/orderTypeName", "Special / Supply Order");
      oAppState.setProperty("/orderHeader/orderTypeDesc", "ZSP · Warehouse Supply");
    },

    onNextToProducts: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/currentStep", 5);
      this.navTo("products");
    },

    onNavToConsent: function () {
      this.navTo("consent");
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
