sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController"
], function (BaseController) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.App", {
    onInit: function () {
      this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
    }
  });
});
