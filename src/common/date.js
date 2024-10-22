
export function PrettyElapsedTime(time) {
    /*
        * JavaScript Pretty Date
        * Copyright (c) 2008 John Resig (jquery.com)
        * Licensed under the MIT license.
         */
        if (!time) { return ""; }
        
        var	diff = time / 1000;
        var	min_diff = Math.floor(diff / 60);
        var	hour_diff = Math.floor(diff / 3600);
        var	day_diff = Math.floor(diff / 86400);
        var week_diff = Math.floor(day_diff / 7);
        var month_diff = Math.floor(day_diff / 30);
        var year_diff = Math.floor(day_diff / 365);
                                
        if (diff < 60) return `${Math.floor(diff)} sec`;
        if (min_diff < 2) return `1:${Math.floor(diff - 60)} min`;
        if (min_diff < 60) return `${Math.floor(min_diff)} mins`;
        if (hour_diff < 2) return `1 hour ${Math.floor(min_diff-60)} mins`;
        if (hour_diff < 24) return `${Math.floor(hour_diff)} hours`;
        if (day_diff < 2) return `1 day ${Math.floor(hour_diff-24)} hours`;
        if (day_diff < 7) return `${Math.floor(day_diff)} days`;
        if (week_diff < 2) return `1 week ${Math.floor(day_diff-7)} days`;
        if (week_diff < 4) return `${Math.floor(week_diff)} weeks`;
        if (month_diff < 2) return `1 month ${Math.floor(week_diff-4)} weeks`;
        if (month_diff < 12) return `${Math.floor(month_diff)} months`;
        if (year_diff < 2) return `1 year ${Math.floor(month_diff-12)} months`;
        return `${Math.floor(year_diff)} years`;
    }


    export function PrettyDate(time) {
    /*
        * JavaScript Pretty Date
        * Copyright (c) 2008 John Resig (jquery.com)
        * Licensed under the MIT license.
         */
        if (!time) { return ""; }
        var date = new Date(time);
        var	diff = (((new Date()).getTime() - date.getTime()) / 1000);
        var	min_diff = Math.floor(diff / 60);
        var	hour_diff = Math.floor(diff / 3600);
        var	day_diff = Math.floor(diff / 86400);
        var week_diff = Math.floor(day_diff / 7);
        var month_diff = Math.floor(day_diff / 30);
        var year_diff = Math.floor(day_diff / 365);
                                
        if ( isNaN(day_diff)) {
            //console.log("PrettyDate failed - " + time);
            return "";
        }

                
        if (diff < 60) return "just now";
        if (min_diff < 2) return "1 minute ago";
        if (min_diff < 60) return min_diff + " minutes ago";
        if (hour_diff < 2) return "1 hour ago";
        if (hour_diff < 24) return hour_diff + " hours ago";
        if (day_diff < 2) return "Yesterday";
        if (day_diff < 7) return day_diff + " days ago";
        if (week_diff < 2) return "last week";
        if (week_diff < 4) return week_diff + " weeks ago";
        if (month_diff < 2) return "last month";
        if (month_diff < 12) return month_diff + " months ago";
        if (year_diff < 2) return "last year";
        return year_diff + " years ago";
    }
