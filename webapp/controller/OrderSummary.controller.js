sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController",
  "sap/m/MessageToast"
], function (BaseController, MessageToast) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.OrderSummary", {
    onInit: function () {
      var oRouter = this.getRouter();
      oRouter.getRoute("orderSummary").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/currentStep", 7);
      this.recalculateTotals();

      var bSame = oAppState.getProperty("/delivery/sameAsBilling");
      var sStatus = bSame
        ? oAppState.getProperty("/customer/address/status")
        : oAppState.getProperty("/delivery/differentAddress/status");

      var sPendingAction = "";
      if (sStatus === "NEW") {
        sPendingAction = "On Create: Create SD Customer and Address (OData) → Create Sales Order";
      } else if (sStatus === "MODIFIED") {
        sPendingAction = "On Create: Update SD Customer Address (OData) → Create Sales Order";
      } else {
        sPendingAction = "On Create: None – Create Sales Order directly";
      }

      oAppState.setProperty("/pendingActionText", sPendingAction);
    },

    onCreateSalesOrder: function () {
      var oAppState = this.getModel("appState");
      var sSalesOrderNo = "5000012345";
      var sShipToBp = "1000234588";

      oAppState.setProperty("/orderFinal/salesOrderNo", sSalesOrderNo);
      oAppState.setProperty("/orderFinal/shipToBp", sShipToBp);
      oAppState.setProperty("/orderFinal/shipmentPriority", "02");
      oAppState.setProperty("/orderFinal/shipmentPriorityText", "02 – High");
      oAppState.setProperty("/orderFinal/remarks", "Customer collecting item 20 on Friday");
      oAppState.setProperty("/currentStep", 8);

      MessageToast.show("Sales Order " + sSalesOrderNo + " created successfully!");
      this.navTo("orderFinal");
    },

    onNavToDeliveryAddress: function () {
      this.navTo("deliveryAddress");
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
