define(['App', 'underscore', 'backbone', 'hbs!template/subreddit', 'view/basem-view', 'collection/subreddit', 'cView/subreddit-grid', 'view/post-row-grid-view', 'cView/subreddit', 'view/post-row-view', 'cookie'],
	function(App, _, Backbone, subredditTmpl, BaseView, SubredditCollection, SrCGridView, PostRowGridView, SrCView, PostRowView, Cookie) {
		return BaseView.extend({
			template: subredditTmpl,
			//className: 'content',
			events: {
				'click #retry': 'tryAgain',
				//'click .thumbnailSmall': 'gotoSingle',
				//'click a': 'gotoSingle',
				'click .nextprev': 'fetchMore',
				//events for dropdown timeframe
				'click .drop-time-frame': 'toggleTimeFrame',
				'click .drop-time-frameSR': 'toggleTimeFrame'

			},
			ui: {
				'siteTableContainer': '#siteTableContainer',
				'nextprev': '.nextprev',
				'srTimeFrame': '#srTimeFrame',
				'dropTimeFrameSR': '.drop-time-frameSR'
			},
			regions: {
				'siteTableContainer': '#siteTableContainer'
			},
			initialize: function(options) {
				//_.bindAll(this);
				_.bindAll(this, 'gotNewPosts', 'fetchError')
				var self = this;
				this.subredditCollectionView = null;
				this.subName = options.subName

				if (this.subName == 'front') {
					document.title = "redditjs beta"
				} else {
					document.title = this.subName + " - redditjs beta"
				}

				this.gridOption = App.settings.get('gridOption') || 'normal';
				this.sortOrder = options.sortOrder
				this.domain = options.domain || null
				this.timeFrame = options.timeFrame

				//putting stuff in model so we can pass to handlebars template
				this.model = new Backbone.Model({
					sortOrder: this.sortOrder,
					subName: this.subName,
					timeFrame: this.timeFrame
				})

				this.subID = this.subName + this.domain + this.sortOrder + this.timeFrame
				console.log('subid in SR', this.subID)
				if (typeof this.sortOrder === 'undefined') {
					this.sortOrder = 'hot'
				}

				this.loading = false;

				App.on("subreddit:changeGridOption", this.changeGridOption, this);
				//App.on("subreddit:remove", this.remove, this);
				//this.render();
				//this.imagesAdded = 0; //keeps a total of how many images we are loading
				//this.imgAry = []

				//$(window).on("scroll", this.watchScroll);
				$(window).on("scroll", this.debouncer(function(e) {

					self.watchScroll()
				}));
				//$(window).resize(this.debouncer(function(e) {
				//self.resize()
				//}));

				//this.target = $("#siteTableContainer"); //the target to test for infinite scroll
				this.target = $(window); //the target to test for infinite scroll
				this.loading = false;

				this.scrollOffset = 1000;
				this.prevScrollY = 0; //makes sure you are not checking when the user scrolls upwards
				this.errorRetries = 0; //keeps track of how many errors we will retry after

				setTimeout(function() {
					self.changeHeaderLinks()
				}, 100);

			},

			onBeforeClose: function() {
				console.log('closing subreddit-view')
				//window.stop() //prevents new images from being downloaded

				//$(window).off('resize');
				$(window).off("scroll");

				App.off("subreddit:changeGridOption", this.changeGridOption, this);
				App.off("subreddit:remove", this.remove, this);

				//sometimes we hide the sidebar with gridview, in single post view we want to see it.
				if (App.settings.get('showSidebar') === true) {
					if (App.mobileWidth > $(document).width()) {
						$('.side').hide()
					} else {
						$('.side').show()
					}
				}

			},

			onRender: function() {
				var self = this
				this.initGridOption();
				//$(this.el).prepend("<style id='dynamicWidth'> </style>")
				//console.log("window.subs=", window.subs)

				if (typeof App.subs[this.subID] === 'undefined') {

					this.collection = new SubredditCollection([], {
						domain: this.domain,
						subName: this.subName,
						sortOrder: this.sortOrder,
						timeFrame: this.timeFrame
					});
					if (this.collection.length < 100) {
						this.fetchMore();
					}

				} else {
					console.log('loading collection from memory')
					this.collection = App.subs[this.subID]
					this.showMoarBtn()
					//this.fetchMore();
				}

				this.setupCollectionView()

				if (typeof this.collection !== 'undefined' && typeof this.collection.scroll !== 'undefined') {
					setTimeout(function() {
						$(window).scrollTop(self.collection.scroll)
					}, 10)

				}

				//show or hide the timeframe option
				if (this.sortOrder == 'controversial' || this.sortOrder == 'top') {
					this.ui.srTimeFrame.show()
				} else {
					this.ui.srTimeFrame.hide()
				}

				this.hideMoarBtn()
				//this.resize()
				this.helpFillUpScreen();
			},
			toggleTimeFrame: function() {
				this.ui.dropTimeFrameSR.toggle()
			},
			setupCollectionView: function() {
				var self = this
				if (this.gridOption == 'grid') {
					this.subredditCollectionView = new SrCGridView({
						collection: this.collection
						//itemView: PostRowGridView
					})

				} else {
					this.subredditCollectionView = new SrCView({
						collection: this.collection,
						itemView: PostRowView,
						gridOption: this.gridOption
					})
				}
				this.siteTableContainer.show(this.subredditCollectionView)
			},
			//gotoSingle: function(e) {
			//var name = this.$(e.currentTarget).data('id')
			//App.curModel = this.collection.findWhere({
			//name: name
			//})
			//},

			/**************Grid functions ****************/
			initGridOption: function() {
				var self = this
					/*grid option:
					normal - the default Reddit styling
					small - small thumbnails in the page
					large - full sized images in the page
				*/
				this.gridOption = App.settings.get('gridOption')
				if (typeof this.gridOption === 'undefined' || this.gridOption === null || this.gridOption === "") {
					this.gridOption = 'normal'
				}

			},

			changeHeaderLinks: function() {
				App.trigger("header:updateSortOrder", {
					sortOrder: this.sortOrder,
					domain: this.domain,
					subName: this.subName
				});
			},

			resize: function() {

				//if (App.settings.get('showSidebar') === true && this.gridOption != "grid") {

				//if (App.mobileWidth > $(document).width()) {
				//$('.side').hide()
				//} else {
				//$('.side').show()
				//}
				//}

			},

			changeGridOption: function(data) {
				var self = this
				if (typeof data.gridOption === 'undefined') {
					this.gridOption = pp.settings.get('gridOption');
				}
				if (this.gridOption == data.gridOption) {
					return;
					//do nothingif the user already clicked this once
				}

				this.gridOption = data.gridOption

				App.settings.set('gridOption', this.gridOption);

				//this.subredditCollectionView.close()  //we don't need to close view before showing new one
				this.setupCollectionView()
				//this.resize()
				this.helpFillUpScreen()

			},
			/**************Fetching functions ****************/
			fetchError: function(response, error) {
				console.log("fetch error, lets retry", this.collection)
				if (this.errorRetries < 10) {
					this.loading = false;
					this.showMoarBtn()
				}

				if (error && error.status === 419) {
					console.log('show them the relogin modal')
				}

				if (this.collection.length <= 5) {
					this.ui.siteTableContainer.html("<div id='retry' >  <img src='img/sad-icon.png' /><br /> click here to try again </div> ")
				}
				this.errorRetries++;

			},
			tryAgain: function() {
				this.$('#retry').remove()

				this.fetchMore();
			},
			fetchMore: function() {
				//$(this.el).append("<div class='loading'> </div>")
				this.loading = true
				this.hideMoarBtn()

				if (this.collection.after == "stop") {
					this.ui.nextprev.html('Done')
				} else {

					this.collection.fetch({
						success: this.gotNewPosts,
						error: this.fetchError,
						remove: false
					});
				}
			},

			gotNewPosts: function(models, res) {
				this.loading = false; //turn the flag on to go ahead and fetch more!
				App.subs[this.subID] = this.collection
				this.showMoarBtn()

				//fetch more  posts with the After
				if (this.collection.after == "stop") {
					console.log("AFTER = stop")
					$(window).off("scroll", this.watchScroll);
					this.ui.nextprev.html('Done')
				}

			},

			/**************Infinite Scroll functions ****************/
			watchScroll: function(e) {
				console.log('watching scroll in ', this.subID)

				if (App.settings.get('infin') === true) {

					var self = this;
					if (this.gridOption == 'grid') {
						this.triggerPoint = 5000; // px from the bottom 
					} else {
						this.triggerPoint = 2000; // px from the bottom 
					}

					//keep the scrollheight in the collection so when we return to it, we can auto-move to it
					//bad?
					//if we are not checking for this it will reset the scrolltop back to zero when we reach this subreddit
					var windowScrollTop = $(window).scrollTop()
					if (typeof App.subs[this.subID] !== 'undefined') {
						//this.collection.scroll = windowScrollTop
						App.subs[this.subID].scroll = windowScrollTop

					}

					if ((($(window).scrollTop() + $(window).height()) + this.triggerPoint >= $(document).height()) && this.loading === false) {

						console.log('loading MOAR')
						if (this.collection.after != "stop") {
							this.fetchMore()
						} else {
							this.ui.nextprev.html('Done')
						}
					}
					//this.prevScrollY = scrollY;
				}
			},
			helpFillUpScreen: function() {
				//in small thumbnail mode, its sometimes impossible for the infinite scroll event to fire because there is no scrollbar yet
				if (this.collection.length < 301 && (this.gridOption == 'small')) {
					this.watchScroll()
				}

				if (this.collection.length < 55 && this.gridOption == 'grid') {

					this.watchScroll()
				}

			},

			showMoarBtn: function() {
				if (this.isClosed === false) {
					this.ui.nextprev.html('MOAR ›').show()
				}
			},
			hideMoarBtn: function() {
				if (this.isClosed === false) {
					this.ui.nextprev.html('<img class="loadingMOAR" src="img/loading.gif" />').show()
				}
			}

		});

	});