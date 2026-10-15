sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController",
  "sap/m/MessageToast"
], function (BaseController, MessageToast) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.DeliveryAddress", {
    onInit: function () {
      var oRouter = this.getRouter();
      oRouter.getRoute("deliveryAddress").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this.getModel("appState").setProperty("/currentStep", 6);
    },

    onToggleSameAsBilling: function (oEvent) {
      var bState = oEvent.getParameter("state");
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/sameAsBilling", bState);

      if (!bState) {
        // Toggle OFF -> opens plug-in again for ship-to address (Screen 14)
        this.onChangeDifferentAddress();
      } else {
        MessageToast.show("Reusing validated billing address from session (no second plug-in call)");
      }
    },

    onChangeDifferentAddress: function () {
      var that = this;
      var oAppState = this.getModel("appState");

      this.openAddressValidationDialog("Ship-To", function (oSelectedAddress) {
        if (oSelectedAddress) {
          var oDiff = {
            street: oSelectedAddress.street,
            city: oSelectedAddress.city,
            postalCode: oSelectedAddress.postalCode,
            region: oSelectedAddress.region,
            formatted: oSelectedAddress.formatted,
            status: oSelectedAddress.status || "MODIFIED",
            statusState: that.formatter.addressStatusState(oSelectedAddress.status),
            note: oSelectedAddress.note || "Selected for ship-to delivery"
          };
          oAppState.setProperty("/delivery/differentAddress", oDiff);
          MessageToast.show("Ship-to address selected (" + oDiff.status + ")");
        }
      });
    },

    onNextToReview: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/currentStep", 7);
      this.navTo("orderSummary");
    },

    onNavToDeliveryMethod: function () {
      this.navTo("deliveryMethod");
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
