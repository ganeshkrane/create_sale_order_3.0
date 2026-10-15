sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController",
  "sap/m/MessageToast",
  "sap/ui/salesorder/store/model/models"
], function (BaseController, MessageToast, models) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.OrderFinal", {
    onInit: function () {
      var oRouter = this.getRouter();
      oRouter.getRoute("orderFinal").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this.getModel("appState").setProperty("/currentStep", 8);
    },

    onSaveShipmentPriority: function () {
      var oAppState = this.getModel("appState");
      var sOrderNo = oAppState.getProperty("/orderFinal/salesOrderNo");
      var sPriority = oAppState.getProperty("/orderFinal/shipmentPriority");
      var sPriorityText = sPriority === "01" ? "01 – Immediate" : (sPriority === "02" ? "02 – High" : (sPriority === "03" ? "03 – Standard" : "04 – Low"));
      oAppState.setProperty("/orderFinal/shipmentPriorityText", sPriorityText);

      MessageToast.show(this.getText("prioritySavedMsg", [sPriorityText, sOrderNo]));
    },

    onCreateNewOrder: function () {
      var oOwnerComponent = this.getOwnerComponent();
      // Reset fresh app state model
      oOwnerComponent.setModel(models.createAppStateModel(), "appState");
      this.navTo("customerSearch");
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
