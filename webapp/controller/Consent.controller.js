sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController",
  "sap/m/MessageToast"
], function (BaseController, MessageToast) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.Consent", {
    onInit: function () {
      var oRouter = this.getRouter();
      oRouter.getRoute("consent").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this.getModel("appState").setProperty("/currentStep", 3);
    },

    onSaveCustomerAndContinue: function () {
      var oAppState = this.getModel("appState");
      var sBp = oAppState.getProperty("/customer/bpNumber");

      MessageToast.show(this.getText("bpSavedSuccessMsg", [sBp]));

      oAppState.setProperty("/currentStep", 4);
      this.navTo("orderType");
    },

    onNavToBasicDetails: function () {
      this.navTo("basicDetails");
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
