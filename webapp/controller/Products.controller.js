sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast"
], function (BaseController, JSONModel, Filter, FilterOperator, MessageToast) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.Products", {
    onInit: function () {
      var oFilterModel = new JSONModel({
        query: "",
        category: "All"
      });
      this.getView().setModel(oFilterModel, "productFilter");

      var oRouter = this.getRouter();
      oRouter.getRoute("products").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this.getModel("appState").setProperty("/currentStep", 5);
    },

    onLiveSearchProducts: function (oEvent) {
      this._applyProductFilters();
    },

    onCategoryFilterChange: function () {
      this._applyProductFilters();
    },

    _applyProductFilters: function () {
      var oFilterData = this.getView().getModel("productFilter").getData();
      var sQuery = (oFilterData.query || "").trim();
      var sCategory = oFilterData.category;
      var aFilters = [];

      if (sQuery) {
        aFilters.push(new Filter({
          filters: [
            new Filter("name", FilterOperator.Contains, sQuery),
            new Filter("articleId", FilterOperator.Contains, sQuery)
          ],
          and: false
        }));
      }

      if (sCategory && sCategory !== "All") {
        aFilters.push(new Filter("category", FilterOperator.EQ, sCategory));
      }

      var oTable = this.byId("productsCatalogTable");
      var oBinding = oTable.getBinding("items");
      oBinding.filter(aFilters);
    },

    onAddToCart: function (oEvent) {
      var oButton = oEvent.getSource();
      var oContext = oButton.getBindingContext("products");
      var oProduct = oContext.getObject();
      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];

      // Check if product already in cart
      var oExisting = null;
      for (var i = 0; i < aCart.length; i++) {
        if (aCart[i].articleId === oProduct.articleId && !aCart[i].isSubItem) {
          oExisting = aCart[i];
          break;
        }
      }

      if (oExisting) {
        oExisting.qty += 1;
        oExisting.netValue = +(oExisting.qty * oExisting.netPrice).toFixed(2);
      } else {
        var nItemNo = (aCart.filter(function(i){ return !i.isSubItem; }).length + 1) * 10;
        var oNewItem = {
          item: String(nItemNo),
          articleId: oProduct.articleId,
          name: oProduct.name,
          qty: 1,
          itemCat: "TAN",
          netPrice: oProduct.price,
          discountPct: 0,
          hasCondition: false,
          conditionText: "",
          netValue: oProduct.price,
          isSubItem: false
        };
        aCart.push(oNewItem);

        // Auto-propose value added items (EGP or Table Cover as per mockup Screen 10)
        if (oProduct.hasEgp) {
          aCart.push({
            item: nItemNo + ".1",
            articleId: oProduct.egpArticle,
            name: oProduct.egpName,
            subText: "value-added to item " + nItemNo,
            qty: 1,
            itemCat: "ZSRV",
            netPrice: oProduct.egpPrice,
            discountPct: 0,
            hasCondition: false,
            conditionText: "",
            netValue: oProduct.egpPrice,
            isSubItem: true,
            parentItem: String(nItemNo)
          });
        } else if (oProduct.hasCover) {
          aCart.push({
            item: nItemNo + ".1",
            articleId: oProduct.coverArticle,
            name: oProduct.coverName,
            subText: "cover article",
            qty: 1,
            itemCat: "TAN",
            netPrice: oProduct.coverPrice,
            discountPct: 0,
            hasCondition: false,
            conditionText: "",
            netValue: oProduct.coverPrice,
            isSubItem: true,
            parentItem: String(nItemNo)
          });
        }
      }

      oAppState.setProperty("/cart", aCart);
      this.recalculateTotals();
      MessageToast.show(this.getText("addedToCartToast", [oProduct.name]));
    },

    onGoToCart: function () {
      this.navTo("cart");
    },

    onNavToOrderType: function () {
      this.navTo("orderType");
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
